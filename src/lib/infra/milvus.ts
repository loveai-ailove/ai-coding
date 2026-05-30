import { MilvusClient, DataType, MetricType } from "@zilliz/milvus2-sdk-node";

const MILVUS_ADDRESS = process.env.MILVUS_ADDRESS || "";
const MILVUS_TOKEN = process.env.MILVUS_TOKEN || "";

declare global {
  var milvusClient: MilvusClient | undefined;
}

export function getMilvusClient(): MilvusClient | null {
  if (!MILVUS_ADDRESS) return null;
  if (global.milvusClient) return global.milvusClient;
  const client = new MilvusClient({
    address: MILVUS_ADDRESS,
    token: MILVUS_TOKEN || undefined,
  });
  global.milvusClient = client;
  return client;
}

const VECTOR_COLLECTION_PREFIX = "kb_";
type SearchVectorHit = {
  id: string;
  score: number;
  datasetId: string;
  collectionId: string;
  dataId: string;
};

function buildSafeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) || "default";
}

function getCollectionName(teamId: string, embeddingModelId: string) {
  return `${VECTOR_COLLECTION_PREFIX}${buildSafeKey(teamId)}_${buildSafeKey(embeddingModelId)}`;
}

export async function initVectorCollection(teamId: string, embeddingModelId: string, dim: number): Promise<string> {
  const client = getMilvusClient();
  if (!client) throw new Error("Milvus is not configured");
  const collectionName = getCollectionName(teamId, embeddingModelId);
  const has = await client.hasCollection({ collection_name: collectionName });
  if (has.value) return collectionName;

  await client.createCollection({
    collection_name: collectionName,
    fields: [
      { name: "id", data_type: DataType.VarChar, is_primary_key: true, max_length: 64 },
      { name: "team_id", data_type: DataType.VarChar, max_length: 64 },
      { name: "dataset_id", data_type: DataType.VarChar, max_length: 64 },
      { name: "collection_id", data_type: DataType.VarChar, max_length: 64 },
      { name: "data_id", data_type: DataType.VarChar, max_length: 64 },
      {
        name: "vector",
        data_type: DataType.FloatVector,
        type_params: { dim: String(dim) },
      },
    ],
  });

  await client.createIndex({
    collection_name: collectionName,
    field_name: "vector",
    index_type: "HNSW",
    metric_type: MetricType.COSINE,
    params: { M: "16", efConstruction: "200" },
  });

  return collectionName;
}

export async function insertVectors(params: {
  teamId: string;
  embeddingModelId: string;
  vectors: Array<{
    id: string;
    datasetId: string;
    collectionId: string;
    dataId: string;
    vector: number[];
  }>;
}): Promise<string[]> {
  const client = getMilvusClient();
  if (!client) throw new Error("Milvus is not configured");
  const collectionName = getCollectionName(params.teamId, params.embeddingModelId);
  const dim = params.vectors[0]?.vector.length || 0;
  await initVectorCollection(params.teamId, params.embeddingModelId, dim);

  const data = params.vectors.map((v) => ({
    id: v.id,
    team_id: params.teamId,
    dataset_id: v.datasetId,
    collection_id: v.collectionId,
    data_id: v.dataId,
    vector: v.vector,
  }));

  await client.insert({ collection_name: collectionName, data });
  return data.map((d) => d.id);
}

export async function deleteVectors(params: {
  teamId: string;
  embeddingModelId: string;
  ids?: string[];
  filter?: string;
}): Promise<void> {
  const client = getMilvusClient();
  if (!client) return;
  const collectionName = getCollectionName(params.teamId, params.embeddingModelId);
  const has = await client.hasCollection({ collection_name: collectionName });
  if (!has.value) return;

  if (params.ids && params.ids.length > 0) {
    const filter = `id in [${params.ids.map((id) => `"${id}"`).join(",")}]`;
    await client.delete({ collection_name: collectionName, filter });
  } else if (params.filter) {
    await client.delete({ collection_name: collectionName, filter: params.filter });
  }
}

export async function searchVectors(params: {
  teamId: string;
  embeddingModelId: string;
  vector: number[];
  topK: number;
  filter?: string;
  datasetIds?: string[];
}): Promise<SearchVectorHit[]> {
  const client = getMilvusClient();
  if (!client) throw new Error("Milvus is not configured");
  const collectionName = getCollectionName(params.teamId, params.embeddingModelId);
  const has = await client.hasCollection({ collection_name: collectionName });
  if (!has.value) return [];
  await client.loadCollection({ collection_name: collectionName });

  let filter = params.filter || "";
  if (params.datasetIds && params.datasetIds.length > 0) {
    const dsFilter = `dataset_id in [${params.datasetIds.map((id) => `"${id}"`).join(",")}]`;
    filter = filter ? `(${filter}) && (${dsFilter})` : dsFilter;
  }

  const results = await client.search({
    collection_name: collectionName,
    anns_field: "vector",
    data: [params.vector],
    limit: params.topK,
    output_fields: ["team_id", "dataset_id", "collection_id", "data_id"],
    filter: filter || undefined,
    metric_type: MetricType.COSINE,
    params: { ef: "200" }
  });

  const rows = Array.isArray((results as any)?.results) ? (results as any).results : [];

  return rows
    .map((r: any): SearchVectorHit => {
      const entity = r.entity || {};
      return {
        id: String(r.id ?? entity.id ?? ""),
        score: Number(r.score ?? r.distance ?? entity.score ?? entity.distance ?? 0),
        datasetId: String(r.dataset_id ?? entity.dataset_id ?? ""),
        collectionId: String(r.collection_id ?? entity.collection_id ?? ""),
        dataId: String(r.data_id ?? entity.data_id ?? "")
      };
    })
    .filter((item: SearchVectorHit) => Boolean(item.dataId));

}
