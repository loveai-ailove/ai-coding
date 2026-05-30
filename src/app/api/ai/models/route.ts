import { NextResponse } from "next/server";
import { requireLogin } from "@/lib/auth/current-user";
import { handleApiError } from "@/lib/api";
import { listAiModels } from "@/lib/ai/model-manager";
import { AiModelType } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    await requireLogin();

    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get("type");

    const type =
      rawType === "LLM" || rawType === "EMBEDDING"
        ? (rawType as AiModelType)
        : undefined;

    const list = await listAiModels(type, true);

    return NextResponse.json({
      list: list.map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        code: item.code,
        provider: item.provider,
        model: item.model,
        isDefault: item.isDefault,
        maxContext: item.maxContext,
        maxResponse: item.maxResponse,
        quoteMaxToken: item.quoteMaxToken,
        maxTemperature: item.maxTemperature,
        defaultSystemPrompt: item.defaultSystemPrompt,
        embeddingDimension: item.embeddingDimension,
        embeddingMaxToken: item.embeddingMaxToken,
        defaultConfig: item.defaultConfig
      }))
    });
  } catch (error) {
    return handleApiError(error, "获取模型列表失败");
  }
}
