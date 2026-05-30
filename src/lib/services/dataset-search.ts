import { getSingleEmbedding } from "@/lib/ai/embedding";
import { searchVectors } from "@/lib/infra/milvus";
import { getDatasetDataModel, getDatasetModel } from "@/lib/models/dataset";
import { connectMongo } from "@/lib/infra/mongo";
import type { Types } from "mongoose";
import { resolveEmbeddingRuntimeModel } from "@/lib/ai/runtime-model";

export interface SearchDataItem {
  id: string;
  q: string;
  a: string;
  score: number;
  datasetId: string;
  collectionId: string;
}

export async function searchDataset(params: {
  userId: string;
  datasetIds: string[];
  query: string;
  similarity?: number;
  limit?: number;
  embeddingModelId?: string;
}): Promise<SearchDataItem[]> {
  await connectMongo();

  const Dataset = await getDatasetModel();
  const datasets = await Dataset.find({
    _id: { $in: params.datasetIds },
    userId: params.userId,
    deleteTime: null,
  }).lean();

  if (datasets.length === 0) return [];

  const embeddingModelId = params.embeddingModelId || String(datasets[0]?.embeddingModelId || "");
  if (!embeddingModelId) {
    throw new Error("知识库未配置嵌入模型");
  }
  const hasMixedEmbeddingModel = datasets.some(
    (item: any) => String(item.embeddingModelId || "") !== embeddingModelId
  );
  if (hasMixedEmbeddingModel) {
    throw new Error("暂不支持跨嵌入模型同时检索多个知识库");
  }
  const model = await resolveEmbeddingRuntimeModel(embeddingModelId);
  const vector = await getSingleEmbedding(model.model, params.query, {
    baseUrl: model.baseUrl,
    apiKey: model.apiKey,
    model: model.model,
    defaultConfig: model.defaultConfig
  });

  const searchResults = await searchVectors({
    teamId: params.userId,
    embeddingModelId,
    vector,
    topK: params.limit || 20,
    datasetIds: params.datasetIds,
  });

  const minScore = typeof params.similarity === "number" ? params.similarity : 0;
  const filtered = searchResults.filter(
    (r) => Number.isFinite(r.score) && r.score >= minScore
  );

  const DatasetData = await getDatasetDataModel();
  const dataIds = filtered.map((r) => r.dataId);
  const dataRecords = await DatasetData.find({ _id: { $in: dataIds } }).lean();

  const dataMap = new Map(dataRecords.map((d: any) => [String(d._id), d]));

  return filtered
    .map((r) => {
      const data = dataMap.get(r.dataId) as any;
      if (!data) return null;
      return {
        id: r.dataId,
        q: data.q,
        a: data.a || "",
        score: r.score,
        datasetId: r.datasetId,
        collectionId: r.collectionId
      };
    })
    .filter(Boolean) as SearchDataItem[];
}
