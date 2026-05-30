import { AiModelType } from "@/generated/prisma/client";
import { getSingleEmbedding } from "@/lib/ai/embedding";
import { chatCompletion } from "@/lib/ai/llm";

type TestAiModelConnectionInput = {
  type: AiModelType;
  baseUrl: string;
  apiKey?: string;
  model: string;
  defaultConfig?: Record<string, any> | null;
  embeddingDimension?: number | null;
};

type TestAiModelConnectionResult = {
  message: string;
  details?: string;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 15000) {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("连通性测试超时，请检查服务地址和网络")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function testAiModelConnection(
  input: TestAiModelConnectionInput
): Promise<TestAiModelConnectionResult> {
  const runtimeConfig = {
    baseUrl: input.baseUrl.trim().replace(/\/$/, ""),
    apiKey: input.apiKey?.trim(),
    model: input.model.trim(),
    defaultConfig: input.defaultConfig || null
  };

  if (input.type === AiModelType.LLM) {
    const response = await withTimeout(
      chatCompletion(
        {
          model: runtimeConfig.model,
          messages: [{ role: "user", content: "ping" }],
          temperature: 0,
          max_tokens: 1
        },
        runtimeConfig
      )
    );

    return {
      message: "语言模型连通性测试通过",
      details: `请求成功，返回 ${response.usage.total_tokens} 个 token`
    };
  }

  const vector = await withTimeout(
    getSingleEmbedding(runtimeConfig.model, "连通性测试", runtimeConfig)
  );

  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("嵌入模型返回了空向量");
  }

  if (input.embeddingDimension && vector.length !== input.embeddingDimension) {
    throw new Error(
      `返回向量维度为 ${vector.length}，与配置维度 ${input.embeddingDimension} 不一致`
    );
  }

  return {
    message: "嵌入模型连通性测试通过",
    details: `请求成功，返回向量维度 ${vector.length}`
  };
}
