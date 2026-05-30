const VLLM_BASE_URL = process.env.VLLM_BASE_URL || "";
const VLLM_API_KEY = process.env.VLLM_API_KEY || "";

export interface EmbeddingRuntimeConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  defaultConfig?: Record<string, any> | null;
}

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
}

export interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export async function getEmbedding(
  model: string,
  input: string | string[],
  runtimeConfig?: EmbeddingRuntimeConfig
): Promise<number[][]> {
  const baseUrl = runtimeConfig?.baseUrl || VLLM_BASE_URL;
  const apiKey = runtimeConfig?.apiKey || VLLM_API_KEY;
  if (!baseUrl) throw new Error("VLLM_BASE_URL is not configured");

  const url = `${baseUrl.replace(/\/$/, "")}/embeddings`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...(runtimeConfig?.defaultConfig || {}),
      model: runtimeConfig?.model || model,
      input,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embedding request failed (${res.status}): ${text}`);
  }

  const data: EmbeddingResponse = await res.json();
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function getSingleEmbedding(
  model: string,
  text: string,
  runtimeConfig?: EmbeddingRuntimeConfig
): Promise<number[]> {
  const vectors = await getEmbedding(model, text, runtimeConfig);
  return vectors[0];
}
