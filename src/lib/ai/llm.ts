const VLLM_BASE_URL = process.env.VLLM_BASE_URL || "";
const VLLM_API_KEY = process.env.VLLM_API_KEY || "";

export interface LlmRuntimeConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  defaultConfig?: Record<string, any> | null;
}

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
  req: ChatCompletionRequest,
  runtimeConfig?: LlmRuntimeConfig
): Promise<ChatCompletionResponse> {
  const baseUrl = runtimeConfig?.baseUrl || VLLM_BASE_URL;
  const apiKey = runtimeConfig?.apiKey || VLLM_API_KEY;
  if (!baseUrl) throw new Error("VLLM_BASE_URL is not configured");

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...(runtimeConfig?.defaultConfig || {}),
      ...req,
      model: runtimeConfig?.model || req.model,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Extract actual content from LLM response, handling Qwen-style <think> tags.
 * Some models (like Qwen) return thinking process in <think>...</think> tags
 * followed by the actual answer.
 */
export function extractAnswerContent(content: string | null | undefined): {
  thinking: string;
  answer: string;
} {
  if (!content) return { thinking: "", answer: "" };
  
  // Extract <think>...</think> blocks
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const thinkingParts: string[] = [];
  let match;
  
  while ((match = thinkRegex.exec(content)) !== null) {
    thinkingParts.push(match[1].trim());
  }
  
  // Remove <think>...</think> blocks to get the actual answer
  const answer = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  
  // If there are think tags, return thinking and answer separately
  // If no think tags found, the entire content is the answer
  if (thinkingParts.length > 0) {
    return {
      thinking: thinkingParts.join("\n\n"),
      answer: answer, // Could be empty string if model only returned thinking
    };
  }
  
  // No think tags, entire content is the answer
  return {
    thinking: "",
    answer: content.trim(),
  };
}

export function sanitizeFinalAnswer(
  answer: string | null | undefined,
  thinking?: string | null
): string {
  const text = (answer || "").trim();
  if (!text) return "";

  const normalizedThinking = (thinking || "")
    .replace(/\r/g, "")
    .trim();
  const normalizedText = text.replace(/\r/g, "").trim();

  if (normalizedThinking && normalizedText === normalizedThinking) {
    return "";
  }

  if (normalizedThinking && normalizedText.startsWith(normalizedThinking)) {
    return normalizedText.slice(normalizedThinking.length).trim();
  }

  // Handle answers that start with meta reasoning labels before the real conclusion.
  const reasoningPrefixes = [
    "Here's a thinking process:",
    "Here is a thinking process:",
    "思考过程：",
    "思考过程:",
    "推理过程：",
    "推理过程:",
    "分析：",
    "分析:",
  ];

  for (const prefix of reasoningPrefixes) {
    if (!normalizedText.startsWith(prefix)) continue;
    const tail = normalizedText.slice(prefix.length).trim();
    const splitPatterns = [
      /\n{2,}(?:最终答案|最终回复|答案|答复)[:：]?\s*/i,
      /\n{2,}(?:final answer|answer)[:：]?\s*/i,
      /\n{2,}/
    ];
    for (const pattern of splitPatterns) {
      const match = tail.match(pattern);
      if (!match || match.index === undefined) continue;
      const candidate = tail.slice(match.index + match[0].length).trim();
      if (candidate && candidate !== tail) {
        return candidate;
      }
    }
  }

  return normalizedText;
}

/**
 * Parse streaming SSE data and extract content chunks
 */
export interface StreamChunk {
  content?: string;
  reasoning_content?: string;
  finish_reason?: string;
}

function normalizeStreamText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return undefined;
}

export function parseStreamChunk(line: string): StreamChunk | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6).trim();
  if (data === "[DONE]") return { finish_reason: "stop" };
  
  try {
    const json = JSON.parse(data);
    const delta = json.choices?.[0]?.delta;
    if (!delta) return null;
    
    return {
      content: normalizeStreamText(
        delta.content ??
          delta.text ??
          delta.message?.content
      ),
      reasoning_content: normalizeStreamText(
        delta.reasoning_content ??
          delta.thinking_content ??
          delta.reasoning ??
          delta.reasoningText ??
          delta.reasoning_text ??
          delta.message?.reasoning_content
      ),
      finish_reason: json.choices?.[0]?.finish_reason,
    };
  } catch {
    return null;
  }
}

export async function chatCompletionStream(
  req: ChatCompletionRequest,
  runtimeConfig?: LlmRuntimeConfig
): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = runtimeConfig?.baseUrl || VLLM_BASE_URL;
  const apiKey = runtimeConfig?.apiKey || VLLM_API_KEY;
  if (!baseUrl) throw new Error("VLLM_BASE_URL is not configured");

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...(runtimeConfig?.defaultConfig || {}),
      ...req,
      model: runtimeConfig?.model || req.model,
      stream: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM stream request failed (${res.status}): ${text}`);
  }

  if (!res.body) throw new Error("No response body");
  return res.body;
}
