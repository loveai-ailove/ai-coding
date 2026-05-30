import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { handleApiError } from "@/lib/api";
import { requireKnowledgePermission } from "@/lib/auth/fastgpt-auth";
import { getDatasetModel, getDatasetDataModel } from "@/lib/models/dataset";
import { insertVectors } from "@/lib/infra/milvus";
import { getEmbedding } from "@/lib/ai/embedding";
import { resolveEmbeddingRuntimeModel } from "@/lib/ai/runtime-model";

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
    const collectionId = searchParams.get("collectionId");

    const DataModel = await getDatasetDataModel();

    const query: Record<string, any> = {
      datasetId,
      userId: user.userId,
    };

    if (collectionId) {
      query.collectionId = collectionId;
    }

    if (cursor) {
      query.updateTime = { $lt: new Date(cursor) };
    }

    const list = await DataModel.find(query)
      .sort({ updateTime: -1 })
      .limit(pageSize + 1)
      .lean();

    const hasMore = list.length > pageSize;
    const data = hasMore ? list.slice(0, pageSize) : list;
    const nextCursor = hasMore ? data[data.length - 1]?.updateTime?.toISOString() : null;

    return NextResponse.json({
      list: data.map((item) => ({
        id: item._id,
        datasetId: item.datasetId,
        collectionId: item.collectionId,
        q: item.q,
        a: item.a || "",
        indexes: item.indexes,
        chunkIndex: item.chunkIndex,
        updateTime: item.updateTime,
      })),
      nextCursor,
    });
  } catch (error) {
    return handleApiError(error, "获取数据列表失败");
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
    const { data: dataItems, collectionId } = body;

    if (!Array.isArray(dataItems) || dataItems.length === 0) {
      throw new Error("数据列表不能为空");
    }

    if (dataItems.length > 100) {
      throw new Error("单次最多推送100条数据");
    }

    const chunkSize = dataset.chunkSize || 512;
    const chunkSplitter = dataset.chunkSplitter || "";
    const embeddingModelId = String(dataset.embeddingModelId || "");
    if (!embeddingModelId) {
      throw new Error("知识库未配置嵌入模型");
    }
    const embeddingModel = await resolveEmbeddingRuntimeModel(embeddingModelId);
    const overlap = Math.floor(chunkSize * 0.2);

    const DataModel = await getDatasetDataModel();
    const createdDocs: any[] = [];
    const createdDocIds: any[] = [];
    const vectorEntries: Array<{ id: string; datasetId: string; collectionId: string; dataId: string; vector: number[] }> = [];

    for (const item of dataItems) {
      const { q, a } = item;
      if (!q || !q.trim()) continue;

      const chunks = splitTextChunks(q, chunkSize, overlap, chunkSplitter);

      for (let i = 0; i < chunks.length; i++) {
        const vectorId = nanoid();

        const doc = await DataModel.create({
          userId: user.userId,
          datasetId,
          collectionId: collectionId || datasetId,
          q: chunks[i],
          a: a || "",
          indexes: [{ type: "custom", dataId: vectorId, text: chunks[i] }],
          chunkIndex: i,
        });

        createdDocs.push(doc);
        createdDocIds.push(doc._id);

        vectorEntries.push({
          id: vectorId,
          datasetId,
          collectionId: collectionId || datasetId,
          dataId: String(doc._id),
          vector: [],
        });
      }
    }

    if (vectorEntries.length > 0) {
      const allTexts = vectorEntries.map((v) => {
        const doc = createdDocs.find((d) => String(d._id) === v.dataId);
        return doc?.q || "";
      });

      const runtimeConfig = {
        baseUrl: embeddingModel.baseUrl,
        apiKey: embeddingModel.apiKey,
        model: embeddingModel.model,
        defaultConfig: embeddingModel.defaultConfig
      };

      const embeddings = await embedTextsInBatches(embeddingModel.model, allTexts, runtimeConfig);

      for (let i = 0; i < vectorEntries.length; i++) {
        vectorEntries[i].vector = embeddings[i];
      }

      try {
        await insertVectors({ teamId: user.userId, embeddingModelId, vectors: vectorEntries });
      } catch (err) {
        if (createdDocIds.length > 0) {
          await DataModel.deleteMany({ _id: { $in: createdDocIds } }).catch(() => {});
        }
        throw err;
      }
    }

    await Dataset.updateOne(
      { _id: datasetId },
      { updateTime: new Date() }
    );

    return NextResponse.json({
      inserted: createdDocs.length,
      ids: createdDocs.map((d) => d._id),
    });
  } catch (error) {
    return handleApiError(error, "推送数据失败");
  }
}
