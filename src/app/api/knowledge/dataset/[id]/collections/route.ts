import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { handleApiError } from "@/lib/api";
import { requireKnowledgePermission } from "@/lib/auth/fastgpt-auth";
import { getDatasetModel, getDatasetCollectionModel, getDatasetDataModel } from "@/lib/models/dataset";
import { insertVectors } from "@/lib/infra/milvus";
import { getEmbedding } from "@/lib/ai/embedding";

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTextChunks(text: string, chunkSize: number, overlap: number, splitter?: string): string[] {
  if (splitter && text.includes(splitter)) {
    const parts = text.split(splitter).filter((s) => s.trim());
    const chunks: string[] = [];
    let current = "";
    for (const part of parts) {
      const candidate = current ? current + splitter + part : part;
      if (candidate.length > chunkSize && current) {
        chunks.push(current);
        const overlapText = current.slice(-overlap);
        current = overlapText + splitter + part;
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
    start = end - overlap;
  }
  return chunks.filter((c) => c.trim());
}

async function processTextToVectors(params: {
  userId: string;
  datasetId: string;
  collectionId: string;
  rawText: string;
  chunkSize: number;
  chunkSplitter: string;
  vectorModel: string;
}) {
  const overlap = Math.floor(params.chunkSize * 0.2);
  const chunks = splitTextChunks(params.rawText, params.chunkSize, overlap, params.chunkSplitter);

  if (chunks.length === 0) {
    return { dataCount: 0, chunks: [] };
  }

  const DatasetData = await getDatasetDataModel();
  const dataDocs: Array<{ _id: any; q: string; indexes: Array<{ dataId: string; text: string }> }> = [];
  const vectorEntries: Array<{ id: string; datasetId: string; collectionId: string; dataId: string; vector: number[] }> = [];

  const embeddings = await getEmbedding(params.vectorModel, chunks);

  for (let i = 0; i < chunks.length; i++) {
    const dataId = nanoid();
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
    await insertVectors({ teamId: params.userId, vectors: vectorEntries });
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

    const body = await request.json();
    const { name, type, rawText, rawLink, tags } = body;

    if (!name || !name.trim()) {
      throw new Error("集合名称不能为空");
    }

    if (!type || !["text", "link", "file"].includes(type)) {
      throw new Error("集合类型无效，仅支持 text、link、file");
    }

    const CollectionModel = await getDatasetCollectionModel();

    let content = rawText || "";

    if (type === "link") {
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

    if (!content.trim()) {
      throw new Error("内容不能为空");
    }

    const collection = await CollectionModel.create({
      userId: user.userId,
      datasetId,
      name: name.trim(),
      type,
      tags: tags || [],
      rawLink: type === "link" ? rawLink : undefined,
      rawTextLength: content.length,
      chunkSize: dataset.chunkSize,
      chunkSplitter: dataset.chunkSplitter,
    });

    const chunkSize = dataset.chunkSize || 512;
    const chunkSplitter = dataset.chunkSplitter || "";
    const vectorModel = dataset.vectorModel || process.env.DEFAULT_EMBEDDING_MODEL || "text-embedding-3-small";

    const result = await processTextToVectors({
      userId: user.userId,
      datasetId,
      collectionId: String(collection._id),
      rawText: content,
      chunkSize,
      chunkSplitter,
      vectorModel,
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
