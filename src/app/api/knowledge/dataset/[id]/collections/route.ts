import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { handleApiError } from "@/lib/api";
import { requireKnowledgePermission } from "@/lib/auth/fastgpt-auth";
import { getDatasetModel, getDatasetCollectionModel, getDatasetDataModel } from "@/lib/models/dataset";
import { insertVectors } from "@/lib/infra/milvus";
import { getEmbedding } from "@/lib/ai/embedding";
import { resolveEmbeddingRuntimeModel } from "@/lib/ai/runtime-model";
import { assertSupportedKnowledgeFile, parseKnowledgeFile, htmlToText } from "@/lib/knowledge/file-parser";
import { ensureBuckets, getPrivateUrl, minioClient, STORAGE_PRIVATE_BUCKET } from "@/lib/infra/storage";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const EMBEDDING_BATCH_SIZE = 50;
const EMBEDDING_MAX_RETRIES = 3;

function splitTextChunks(text: string, chunkSize: number, overlap: number, splitter?: string): string[] {
  const safeOverlap = Math.min(overlap, Math.floor(chunkSize / 2));

  if (splitter && text.includes(splitter)) {
    const parts = text.split(splitter).filter((s) => s.trim());
    const chunks: string[] = [];
    let current = "";
    for (const part of parts) {
      const candidate = current ? current + splitter + part : part;
      if (candidate.length > chunkSize && current) {
        chunks.push(current);
        const overlapLength = Math.min(safeOverlap, current.length);
        const overlapText = overlapLength > 0 ? current.slice(-overlapLength) : "";
        current = overlapText ? overlapText + splitter + part : part;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) {
      chunks.push(current);
    }
    return chunks.filter((c) => c.trim());
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - safeOverlap;
  }
  return chunks.filter((c) => c.trim());
}

async function getEmbeddingWithRetry(
  model: string,
  texts: string[],
  runtimeConfig: {
    baseUrl: string;
    apiKey: string;
    model: string;
    defaultConfig?: Record<string, any> | null;
  }
): Promise<number[][]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < EMBEDDING_MAX_RETRIES; attempt++) {
    try {
      return await getEmbedding(model, texts, runtimeConfig);
    } catch (err) {
      lastError = err;
      if (attempt < EMBEDDING_MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function embedTextsInBatches(
  model: string,
  texts: string[],
  runtimeConfig: {
    baseUrl: string;
    apiKey: string;
    model: string;
    defaultConfig?: Record<string, any> | null;
  }
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchEmbeddings = await getEmbeddingWithRetry(model, batch, runtimeConfig);
    allEmbeddings.push(...batchEmbeddings);
  }
  return allEmbeddings;
}

async function processTextToVectors(params: {
  userId: string;
  datasetId: string;
  collectionId: string;
  embeddingModelId: string;
  rawText: string;
  chunkSize: number;
  chunkSplitter: string;
}) {
  const overlap = Math.floor(params.chunkSize * 0.2);
  const chunks = splitTextChunks(params.rawText, params.chunkSize, overlap, params.chunkSplitter);

  if (chunks.length === 0) {
    return { dataCount: 0, chunks: [] };
  }

  const DatasetData = await getDatasetDataModel();
  const embeddingModel = await resolveEmbeddingRuntimeModel(params.embeddingModelId);
  const runtimeConfig = {
    baseUrl: embeddingModel.baseUrl,
    apiKey: embeddingModel.apiKey,
    model: embeddingModel.model,
    defaultConfig: embeddingModel.defaultConfig
  };

  const embeddings = await embedTextsInBatches(embeddingModel.model, chunks, runtimeConfig);

  const dataDocs: Array<{ _id: any; q: string; indexes: Array<{ dataId: string; text: string }> }> = [];
  const vectorEntries: Array<{ id: string; datasetId: string; collectionId: string; dataId: string; vector: number[] }> = [];

  const createdDocIds: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const vectorId = nanoid();

    const doc = await DatasetData.create({
      userId: params.userId,
      datasetId: params.datasetId,
      collectionId: params.collectionId,
      q: chunks[i],
      a: "",
      indexes: [{ type: "custom", dataId: vectorId, text: chunks[i] }],
      chunkIndex: i,
    });

    createdDocIds.push(doc._id);
    dataDocs.push(doc);
    vectorEntries.push({
      id: vectorId,
      datasetId: params.datasetId,
      collectionId: params.collectionId,
      dataId: String(doc._id),
      vector: embeddings[i],
    });
  }

  if (vectorEntries.length > 0) {
    try {
      await insertVectors({
        teamId: params.userId,
        embeddingModelId: params.embeddingModelId,
        vectors: vectorEntries
      });
    } catch (err) {
      if (createdDocIds.length > 0) {
        await DatasetData.deleteMany({ _id: { $in: createdDocIds } }).catch(() => {});
      }
      throw err;
    }
  }

  return { dataCount: chunks.length, chunks };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireKnowledgePermission("knowledge:read");
    const { id: datasetId } = await params;

    const Dataset = await getDatasetModel();
    const dataset = await Dataset.findOne({
      _id: datasetId,
      userId: user.userId,
      deleteTime: null,
    }).lean();

    if (!dataset) {
      throw new Error("NOT_FOUND");
    }

    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const cursor = searchParams.get("cursor");
    const type = searchParams.get("type");

    const CollectionModel = await getDatasetCollectionModel();

    const query: Record<string, any> = {
      datasetId,
      userId: user.userId,
      deleteTime: null,
    };

    if (type) {
      query.type = type;
    }

    if (cursor) {
      query.updateTime = { $lt: new Date(cursor) };
    }

    const list = await CollectionModel.find(query)
      .sort({ updateTime: -1 })
      .limit(pageSize + 1)
      .lean();

    const hasMore = list.length > pageSize;
    const data = hasMore ? list.slice(0, pageSize) : list;
    const nextCursor = hasMore ? data[data.length - 1]?.updateTime?.toISOString() : null;

    const DataModel = await getDatasetDataModel();
    const collectionIds = data.map((item) => item._id);
    const dataCounts = await DataModel.aggregate([
      { $match: { collectionId: { $in: collectionIds } } },
      { $group: { _id: "$collectionId", count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    for (const dc of dataCounts) {
      countMap.set(String(dc._id), dc.count);
    }

    return NextResponse.json({
      list: data.map((item) => ({
        id: item._id,
        datasetId: item.datasetId,
        name: item.name,
        type: item.type,
        tags: item.tags,
        fileExt: item.fileExt,
        fileSize: item.fileSize,
        chunkSize: item.chunkSize,
        rawLink: item.rawLink,
        rawTextLength: item.rawTextLength,
        createTime: item.createTime,
        updateTime: item.updateTime,
        forbid: item.forbid,
        dataCount: countMap.get(String(item._id)) || 0,
      })),
      nextCursor,
    });
  } catch (error) {
    return handleApiError(error, "获取集合列表失败");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireKnowledgePermission("knowledge:create");
    const { id: datasetId } = await params;

    const Dataset = await getDatasetModel();
    const dataset = await Dataset.findOne({
      _id: datasetId,
      userId: user.userId,
      deleteTime: null,
    });

    if (!dataset) {
      throw new Error("NOT_FOUND");
    }

    const contentType = request.headers.get("content-type") || "";
    let name = "";
    let type = "";
    let rawText = "";
    let rawLink = "";
    let tags: string[] = [];
    let uploadFile: File | null = null;
    let customChunkSize: number | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      name = String(formData.get("name") || "");
      type = String(formData.get("type") || "file");
      rawText = String(formData.get("rawText") || "");
      rawLink = String(formData.get("rawLink") || "");
      const rawTags = String(formData.get("tags") || "");
      tags = rawTags ? rawTags.split(",").map((item) => item.trim()).filter(Boolean) : [];
      const rawChunkSize = String(formData.get("chunkSize") || "");
      customChunkSize = rawChunkSize ? parseInt(rawChunkSize) : undefined;
      const file = formData.get("file");
      if (file instanceof File) {
        uploadFile = file;
      }
    } else {
      const body = await request.json();
      name = String(body.name || "");
      type = String(body.type || "");
      rawText = String(body.rawText || "");
      rawLink = String(body.rawLink || "");
      tags = Array.isArray(body.tags) ? body.tags : [];
      customChunkSize = typeof body.chunkSize === "number" ? body.chunkSize : undefined;
    }

    if (!type || !["text", "link", "file"].includes(type)) {
      throw new Error("集合类型无效，仅支持 text、link、file");
    }

    const CollectionModel = await getDatasetCollectionModel();

    let collectionName = name || "";
    let content = rawText || "";
    let fileKey = "";
    let fileUrl = "";
    let fileExt = "";
    let fileSize = 0;
    let mimeType = "";
    let hashRawText = "";

    if (type === "link") {
      if (!collectionName.trim()) {
        collectionName = rawLink || "网页链接";
      }
      if (!rawLink || !/^https?:\/\//i.test(rawLink)) {
        throw new Error("网页链接不能为空，且必须以 http:// 或 https:// 开头");
      }
      try {
        const res = await fetch(rawLink, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) {
          throw new Error("无法获取链接内容，请检查链接是否有效");
        }
        const html = await res.text();
        content = htmlToText(html);
      } catch {
        throw new Error("无法获取链接内容，请检查链接是否有效");
      }
    }

    if (type === "file") {
      if (!uploadFile) {
        throw new Error("请上传文件");
      }
      if (uploadFile.size > MAX_FILE_SIZE) {
        throw new Error(`文件大小超过限制，最大支持 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`);
      }
      fileExt = assertSupportedKnowledgeFile(uploadFile.name);
      mimeType = uploadFile.type || "application/octet-stream";
      fileSize = uploadFile.size;
      collectionName = collectionName.trim() || uploadFile.name;
      const buffer = Buffer.from(await uploadFile.arrayBuffer());
      content = await parseKnowledgeFile(uploadFile.name, buffer);
      if (!content.trim()) {
        throw new Error("文件内容解析为空，请检查文件格式或内容");
      }

      hashRawText = createHash("sha256").update(content).digest("hex");

      await ensureBuckets();
      const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      fileKey = `knowledge/${user.userId}/${datasetId}/${Date.now()}-${nanoid()}-${safeName}`;
      await minioClient.putObject(STORAGE_PRIVATE_BUCKET, fileKey, buffer, buffer.length, {
        "Content-Type": mimeType,
      });
      fileUrl = getPrivateUrl(fileKey);
    }

    if (!collectionName || !collectionName.trim()) {
      throw new Error("集合名称不能为空");
    }

    if (!content.trim()) {
      throw new Error("内容不能为空");
    }

    if (type !== "file") {
      hashRawText = createHash("sha256").update(content).digest("hex");
    }

    const collection = await CollectionModel.create({
      userId: user.userId,
      datasetId,
      name: collectionName.trim(),
      type,
      tags: tags || [],
      fileId: fileKey || undefined,
      fileKey: fileKey || undefined,
      fileUrl: fileUrl || undefined,
      fileExt: fileExt || undefined,
      fileSize: fileSize || undefined,
      mimeType: mimeType || undefined,
      rawLink: type === "link" ? rawLink : undefined,
      rawTextLength: content.length,
      hashRawText,
      chunkSize: customChunkSize || dataset.chunkSize,
      chunkSplitter: dataset.chunkSplitter,
    });

    const chunkSize = customChunkSize || dataset.chunkSize || 512;
    const chunkSplitter = dataset.chunkSplitter || "";
    const embeddingModelId = String(dataset.embeddingModelId || "");
    if (!embeddingModelId) {
      throw new Error("知识库未配置嵌入模型");
    }

    const result = await processTextToVectors({
      userId: user.userId,
      datasetId,
      collectionId: String(collection._id),
      embeddingModelId,
      rawText: content,
      chunkSize,
      chunkSplitter,
    });

    collection.updateTime = new Date();
    await collection.save();

    await Dataset.updateOne(
      { _id: datasetId },
      { updateTime: new Date() }
    );

    return NextResponse.json({
      id: collection._id,
      datasetId: collection.datasetId,
      name: collection.name,
      type: collection.type,
      tags: collection.tags,
      fileExt: collection.fileExt,
      fileSize: collection.fileSize,
      rawLink: collection.rawLink,
      rawTextLength: content.length,
      createTime: collection.createTime,
      updateTime: collection.updateTime,
      dataCount: result.dataCount,
    });
  } catch (error) {
    return handleApiError(error, "创建集合失败");
  }
}
