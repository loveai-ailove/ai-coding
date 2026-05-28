import { getSingleEmbedding } from "@/lib/ai/embedding";
import { searchVectors } from "@/lib/infra/milvus";
import { getDatasetDataModel, getDatasetModel } from "@/lib/models/dataset";
import { connectMongo } from "@/lib/infra/mongo";
import type { Types } from "mongoose";

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
  vectorModel?: string;
}): Promise<SearchDataItem[]> {
  await connectMongo();

  const Dataset = await getDatasetModel();
  const datasets = await Dataset.find({
    _id: { $in: params.datasetIds },
    userId: params.userId,
    deleteTime: null,
  }).lean();

  if (datasets.length === 0) return [];

  const model = params.vectorModel || datasets[0]?.vectorModel || process.env.DEFAULT_EMBEDDING_MODEL;
  const vector = await getSingleEmbedding(model, params.query);

  const searchResults = await searchVectors({
    teamId: params.userId,
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
