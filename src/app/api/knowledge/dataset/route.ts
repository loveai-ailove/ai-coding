import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { handleApiError } from "@/lib/api";
import { requireKnowledgePermission } from "@/lib/auth/fastgpt-auth";
import { getDatasetModel } from "@/lib/models/dataset";
import { ensureDefaultAiModel, getRequiredAiModel, parseAiModelId } from "@/lib/ai/model-manager";
import { AiModelType } from "@/generated/prisma/client";

export async function GET(request: Request) {
  try {
    const user = await requireKnowledgePermission("knowledge:read");

    const { searchParams } = new URL(request.url);
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const cursor = searchParams.get("cursor");
    const type = searchParams.get("type");

    const Dataset = await getDatasetModel();

    const query: Record<string, any> = {
      userId: user.userId,
      deleteTime: null,
    };

    if (type) {
      query.type = type;
    }

    if (cursor) {
      query.updateTime = { $lt: new Date(cursor) };
    }

    const list = await Dataset.find(query)
      .sort({ updateTime: -1 })
      .limit(pageSize + 1)
      .lean();

    const hasMore = list.length > pageSize;
    const data = hasMore ? list.slice(0, pageSize) : list;
    const nextCursor = hasMore ? data[data.length - 1]?.updateTime?.toISOString() : null;

    return NextResponse.json({
      list: data.map((item) => ({
        id: item._id,
        name: item.name,
        type: item.type,
        avatar: item.avatar,
        intro: item.intro,
        embeddingModelId: item.embeddingModelId,
        embeddingModelName: item.embeddingModelName,
        embeddingDimension: item.embeddingDimension,
        llmModelId: item.llmModelId,
        llmModelName: item.llmModelName,
        vectorModel: item.vectorModel,
        agentModel: item.agentModel,
        chunkSize: item.chunkSize,
        updateTime: item.updateTime,
      })),
      nextCursor,
    });
  } catch (error) {
    return handleApiError(error, "获取知识库列表失败");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireKnowledgePermission("knowledge:create");

    const body = await request.json();
    const { name, intro, embeddingModelId, llmModelId, chunkSize, type } = body;

    if (!name || !name.trim()) {
      throw new Error("知识库名称不能为空");
    }

    if (!type || !["dataset", "folder"].includes(type)) {
      throw new Error("知识库类型无效");
    }

    const Dataset = await getDatasetModel();
    const parsedEmbeddingModelId = parseAiModelId(embeddingModelId);
    const parsedLlmModelId = parseAiModelId(llmModelId);
    const embeddingModel = parsedEmbeddingModelId !== null
      ? await getRequiredAiModel(parsedEmbeddingModelId, AiModelType.EMBEDDING)
      : await ensureDefaultAiModel(AiModelType.EMBEDDING);
    const llmModel = parsedLlmModelId !== null
      ? await getRequiredAiModel(parsedLlmModelId, AiModelType.LLM)
      : await ensureDefaultAiModel(AiModelType.LLM);

    const dataset = await Dataset.create({
      userId: user.userId,
      name: name.trim(),
      intro: intro || "",
      embeddingModelId: String(embeddingModel.id),
      embeddingModelName: embeddingModel.name,
      embeddingDimension: embeddingModel.embeddingDimension || undefined,
      llmModelId: String(llmModel.id),
      llmModelName: llmModel.name,
      vectorModel: embeddingModel.model,
      agentModel: llmModel.model,
      chunkSize: chunkSize || 512,
      type,
    });

    return NextResponse.json({
      id: dataset._id,
      name: dataset.name,
      type: dataset.type,
      avatar: dataset.avatar,
      intro: dataset.intro,
      embeddingModelId: dataset.embeddingModelId,
      embeddingModelName: dataset.embeddingModelName,
      embeddingDimension: dataset.embeddingDimension,
      llmModelId: dataset.llmModelId,
      llmModelName: dataset.llmModelName,
      vectorModel: dataset.vectorModel,
      agentModel: dataset.agentModel,
      chunkSize: dataset.chunkSize,
      updateTime: dataset.updateTime,
    });
  } catch (error) {
    return handleApiError(error, "创建知识库失败");
  }
}
