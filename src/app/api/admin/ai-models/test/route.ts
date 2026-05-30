import { NextResponse } from "next/server";
import { AiModelType } from "@/generated/prisma/client";
import { handleApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth/permission";
import { testAiModelConnection } from "@/lib/ai/model-connectivity";
import { parseAiModelId } from "@/lib/ai/model-manager";
import { prisma } from "@/lib/prisma";

function parseAiModelType(value: unknown) {
  if (value === "LLM" || value === "EMBEDDING") {
    return value as AiModelType;
  }
  throw new Error("模型类型无效");
}

function parseJsonConfig(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, any>;
  if (typeof value !== "string") {
    throw new Error("默认配置格式无效");
  }

  try {
    return JSON.parse(value) as Record<string, any>;
  } catch {
    throw new Error("默认配置必须是合法 JSON");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await requirePermission(body.id ? "model:update" : "model:create");

    const type = parseAiModelType(body.type);
    const modelId = parseAiModelId(body.id);

    if (!body.baseUrl?.trim()) throw new Error("请求地址不能为空");
    if (!body.model?.trim()) throw new Error("模型标识不能为空");

    let apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (apiKey === "__KEEP_EXISTING__") {
      apiKey = "";
    }

    if (!apiKey && modelId !== null) {
      const existing = await prisma.aiModel.findUnique({ where: { id: modelId } });
      if (!existing) throw new Error("模型不存在");
      apiKey = existing.apiKey;
    }

    if (!apiKey) throw new Error("API Key 不能为空");

    if (type === AiModelType.EMBEDDING && !body.embeddingDimension) {
      throw new Error("嵌入模型维度不能为空");
    }

    const result = await testAiModelConnection({
      type,
      baseUrl: String(body.baseUrl),
      apiKey,
      model: String(body.model),
      defaultConfig: parseJsonConfig(body.defaultConfig),
      embeddingDimension:
        type === AiModelType.EMBEDDING ? Number(body.embeddingDimension) || null : null
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "模型连通性测试失败");
  }
}
