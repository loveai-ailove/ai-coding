import { AiModelType } from "@/generated/prisma/client";
import { ensureDefaultAiModel, getAiModelById, parseAiModelId, type AiModelListItem } from "@/lib/ai/model-manager";

export interface RuntimeAiModelConfig {
  id: number | null;
  name: string;
  code: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  type: "LLM" | "EMBEDDING";
  defaultConfig?: Record<string, any> | null;
  maxTemperature?: number | null;
  defaultSystemPrompt?: string | null;
  embeddingDimension?: number | null;
}

function mapRuntimeConfig(model: AiModelListItem): RuntimeAiModelConfig {
  return {
    id: model.id,
    name: model.name,
    code: model.code,
    provider: model.provider,
    model: model.model,
    baseUrl: model.baseUrl,
    apiKey: "",
    type: model.type,
    defaultConfig: model.defaultConfig,
    maxTemperature: model.maxTemperature,
    defaultSystemPrompt: model.defaultSystemPrompt,
    embeddingDimension: model.embeddingDimension
  };
}

export async function resolveLlmRuntimeModel(modelId?: string | number | null) {
  const parsedId = parseAiModelId(modelId);
  if (parsedId !== null) {
    const model = await getAiModelById(parsedId);
    if (!model || model.type !== "LLM" || !model.isActive) {
      throw new Error("语言模型不可用");
    }
    const detail = await getAiModelRecord(model.id);
    return detail;
  }

  const fallback = await ensureDefaultAiModel(AiModelType.LLM);
  return getAiModelRecord(fallback.id);
}

export async function resolveEmbeddingRuntimeModel(modelId?: string | number | null) {
  const parsedId = parseAiModelId(modelId);
  if (parsedId !== null) {
    const model = await getAiModelById(parsedId);
    if (!model || model.type !== "EMBEDDING" || !model.isActive) {
      throw new Error("嵌入模型不可用");
    }
    const detail = await getAiModelRecord(model.id);
    return detail;
  }

  const fallback = await ensureDefaultAiModel(AiModelType.EMBEDDING);
  return getAiModelRecord(fallback.id);
}

async function getAiModelRecord(id: number): Promise<RuntimeAiModelConfig> {
  const { prisma } = await import("@/lib/prisma");
  const model = await prisma.aiModel.findUnique({ where: { id } });
  if (!model) {
    throw new Error("模型不存在");
  }
  return {
    ...mapRuntimeConfig({
      id: model.id,
      type: model.type,
      name: model.name,
      code: model.code,
      provider: model.provider,
      protocol: model.protocol,
      model: model.model,
      baseUrl: model.baseUrl,
      isActive: model.isActive,
      isDefault: model.isDefault,
      sort: model.sort,
      maxContext: model.maxContext,
      maxResponse: model.maxResponse,
      quoteMaxToken: model.quoteMaxToken,
      maxTemperature: model.maxTemperature,
      defaultSystemPrompt: model.defaultSystemPrompt,
      embeddingDimension: model.embeddingDimension,
      embeddingMaxToken: model.embeddingMaxToken,
      defaultConfig: (model.defaultConfig && typeof model.defaultConfig === "object" && !Array.isArray(model.defaultConfig)
        ? (model.defaultConfig as Record<string, any>)
        : null),
      remark: model.remark
    }),
    apiKey: model.apiKey
  };
}
