const VLLM_BASE_URL = process.env.VLLM_BASE_URL || "";
const VLLM_API_KEY = process.env.VLLM_API_KEY || "";

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
}

export interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export async function getEmbedding(model: string, input: string | string[]): Promise<number[][]> {
  if (!VLLM_BASE_URL) throw new Error("VLLM_BASE_URL is not configured");

  const url = `${VLLM_BASE_URL.replace(/\/$/, "")}/embeddings`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (VLLM_API_KEY) headers["Authorization"] = `Bearer ${VLLM_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, input }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embedding request failed (${res.status}): ${text}`);
  }

  const data: EmbeddingResponse = await res.json();
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function getSingleEmbedding(model: string, text: string): Promise<number[]> {
  const vectors = await getEmbedding(model, text);
  return vectors[0];
}
