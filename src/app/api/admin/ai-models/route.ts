import { NextResponse } from "next/server";
import { AiModelType } from "@/generated/prisma/client";
import { handleApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth/permission";
import { prisma } from "@/lib/prisma";
import { listAiModels, mapAiModel, saveAiModelDefaults } from "@/lib/ai/model-manager";

function parseAiModelType(value: unknown) {
  if (value === "LLM" || value === "EMBEDDING") {
    return value as AiModelType;
  }
  throw new Error("模型类型无效");
}

function parseJsonConfig(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") {
    throw new Error("默认配置格式无效");
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("默认配置必须是合法 JSON");
  }
}

export async function GET(request: Request) {
  try {
    await requirePermission("model:read");
    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get("type");
    const type = rawType === "LLM" || rawType === "EMBEDDING" ? (rawType as AiModelType) : undefined;

    return NextResponse.json({
      list: await listAiModels(type)
    });
  } catch (error) {
    return handleApiError(error, "获取模型列表失败");
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission("model:create");
    const body = await request.json();
    const type = parseAiModelType(body.type);

    if (!body.name?.trim()) throw new Error("模型名称不能为空");
    if (!body.code?.trim()) throw new Error("模型编码不能为空");
    if (!body.provider?.trim()) throw new Error("模型提供商不能为空");
    if (!body.model?.trim()) throw new Error("模型标识不能为空");
    if (!body.baseUrl?.trim()) throw new Error("请求地址不能为空");
    if (!body.apiKey?.trim()) throw new Error("API Key 不能为空");

    if (type === "EMBEDDING" && !body.embeddingDimension) {
      throw new Error("嵌入模型维度不能为空");
    }

    const model = await prisma.aiModel.create({
      data: {
        type,
        name: body.name.trim(),
        code: body.code.trim(),
        provider: body.provider.trim(),
        protocol: "openai-compatible",
        model: body.model.trim(),
        baseUrl: body.baseUrl.trim().replace(/\/$/, ""),
        apiKey: body.apiKey.trim(),
        isActive: body.isActive !== false,
        isDefault: !!body.isDefault,
        sort: Number(body.sort || 0),
        maxContext: type === "LLM" ? Number(body.maxContext || 0) || null : null,
        maxResponse: type === "LLM" ? Number(body.maxResponse || 0) || null : null,
        quoteMaxToken: type === "LLM" ? Number(body.quoteMaxToken || 0) || null : null,
        maxTemperature: type === "LLM" ? Number(body.maxTemperature || 0) || null : null,
        defaultSystemPrompt: type === "LLM" ? String(body.defaultSystemPrompt || "") || null : null,
        embeddingDimension: type === "EMBEDDING" ? Number(body.embeddingDimension) : null,
        embeddingMaxToken: type === "EMBEDDING" ? Number(body.embeddingMaxToken || 0) || null : null,
        defaultConfig: parseJsonConfig(body.defaultConfig),
        remark: body.remark?.trim() || null
      }
    });

    await saveAiModelDefaults(type, model.id, model.isDefault);

    return NextResponse.json(mapAiModel(model), { status: 201 });
  } catch (error) {
    return handleApiError(error, "创建模型失败");
  }
}
