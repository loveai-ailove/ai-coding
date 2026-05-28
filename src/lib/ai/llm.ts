const VLLM_BASE_URL = process.env.VLLM_BASE_URL || "";
const VLLM_API_KEY = process.env.VLLM_API_KEY || "";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<{
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  response_format?: { type: "text" | "json_object" };
  stop?: string | string[];
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function chatCompletion(
  req: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  if (!VLLM_BASE_URL) throw new Error("VLLM_BASE_URL is not configured");

  const url = `${VLLM_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (VLLM_API_KEY) headers["Authorization"] = `Bearer ${VLLM_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...req, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function chatCompletionStream(
  req: ChatCompletionRequest
): Promise<ReadableStream<Uint8Array>> {
  if (!VLLM_BASE_URL) throw new Error("VLLM_BASE_URL is not configured");

  const url = `${VLLM_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (VLLM_API_KEY) headers["Authorization"] = `Bearer ${VLLM_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...req, stream: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM stream request failed (${res.status}): ${text}`);
  }

  if (!res.body) throw new Error("No response body");
  return res.body;
}
