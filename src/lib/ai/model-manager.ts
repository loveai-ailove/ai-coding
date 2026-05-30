import { type AiModel, type AiModelType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AiModelListItem = {
  id: number;
  type: AiModelType;
  name: string;
  code: string;
  provider: string;
  protocol: string;
  model: string;
  baseUrl: string;
  isActive: boolean;
  isDefault: boolean;
  sort: number;
  maxContext: number | null;
  maxResponse: number | null;
  quoteMaxToken: number | null;
  maxTemperature: number | null;
  defaultSystemPrompt: string | null;
  embeddingDimension: number | null;
  embeddingMaxToken: number | null;
  defaultConfig: Record<string, any> | null;
  remark: string | null;
};

function normalizeJson(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, any>;
}

export function mapAiModel(model: AiModel): AiModelListItem {
  return {
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
    defaultConfig: normalizeJson(model.defaultConfig),
    remark: model.remark
  };
}

export async function listAiModels(type?: AiModelType, activeOnly = false) {
  const list = await prisma.aiModel.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(activeOnly ? { isActive: true } : {})
    },
    orderBy: [{ isDefault: "desc" }, { sort: "asc" }, { id: "asc" }]
  });

  return list.map(mapAiModel);
}

export function parseAiModelId(id: unknown) {
  const value =
    typeof id === "number"
      ? id
      : typeof id === "string" && id.trim()
        ? Number(id)
        : NaN;

  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export async function getAiModelById(id: number) {
  const modelId = parseAiModelId(id);
  if (modelId === null) {
    return null;
  }
  const model = await prisma.aiModel.findUnique({ where: { id: modelId } });
  return model ? mapAiModel(model) : null;
}

export async function getDefaultAiModel(type: AiModelType) {
  const model =
    (await prisma.aiModel.findFirst({
      where: { type, isActive: true, isDefault: true },
      orderBy: [{ sort: "asc" }, { id: "asc" }]
    })) ||
    (await prisma.aiModel.findFirst({
      where: { type, isActive: true },
      orderBy: [{ sort: "asc" }, { id: "asc" }]
    }));

  return model ? mapAiModel(model) : null;
}

export async function ensureDefaultAiModel(type: AiModelType) {
  const model = await getDefaultAiModel(type);
  if (!model) {
    throw new Error(type === "LLM" ? "请先配置并启用至少一个语言模型" : "请先配置并启用至少一个嵌入模型");
  }
  return model;
}

export async function getRequiredAiModel(id: number, type?: AiModelType) {
  const model = await getAiModelById(id);
  if (!model) {
    throw new Error("模型不存在");
  }
  if (type && model.type !== type) {
    throw new Error("模型类型不匹配");
  }
  return model;
}

export async function saveAiModelDefaults(type: AiModelType, currentId: number, isDefault: boolean) {
  if (!isDefault) return;
  await prisma.aiModel.updateMany({
    where: {
      type,
      NOT: { id: currentId }
    },
    data: { isDefault: false }
  });
}
