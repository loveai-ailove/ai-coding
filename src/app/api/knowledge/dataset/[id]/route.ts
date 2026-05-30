import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireKnowledgePermission } from "@/lib/auth/fastgpt-auth";
import { getDatasetModel, getDatasetCollectionModel, getDatasetDataModel } from "@/lib/models/dataset";
import { deleteVectors } from "@/lib/infra/milvus";
import { getRequiredAiModel, parseAiModelId } from "@/lib/ai/model-manager";
import { AiModelType } from "@/generated/prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireKnowledgePermission("knowledge:read");
    const { id } = await params;

    const Dataset = await getDatasetModel();
    const dataset = await Dataset.findOne({
      _id: id,
      userId: user.userId,
      deleteTime: null,
    }).lean();

    if (!dataset) {
      throw new Error("NOT_FOUND");
    }

    const CollectionModel = await getDatasetCollectionModel();
    const collectionCount = await CollectionModel.countDocuments({
      datasetId: id,
      userId: user.userId,
      deleteTime: null,
    });

    const DataModel = await getDatasetDataModel();
    const dataCount = await DataModel.countDocuments({
      datasetId: id,
      userId: user.userId,
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
      chunkSplitter: dataset.chunkSplitter,
      qaPrompt: dataset.qaPrompt,
      updateTime: dataset.updateTime,
      collectionCount,
      dataCount,
    });
  } catch (error) {
    return handleApiError(error, "获取知识库详情失败");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireKnowledgePermission("knowledge:update");
    const { id } = await params;

    const body = await request.json();
    const { name, intro, llmModelId, chunkSize, chunkSplitter, qaPrompt, avatar } = body;

    const Dataset = await getDatasetModel();
    const dataset = await Dataset.findOne({
      _id: id,
      userId: user.userId,
      deleteTime: null,
    });

    if (!dataset) {
      throw new Error("NOT_FOUND");
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        throw new Error("知识库名称不能为空");
      }
      dataset.name = name.trim();
    }

    if (intro !== undefined) dataset.intro = intro;
    if (body.embeddingModelId !== undefined && String(body.embeddingModelId) !== String(dataset.embeddingModelId || "")) {
      throw new Error("知识库创建后不允许修改嵌入模型，如需更换请新建知识库");
    }
    if (llmModelId !== undefined) {
      const parsedLlmModelId = parseAiModelId(llmModelId);
      if (parsedLlmModelId === null) {
        throw new Error("语言模型ID无效");
      }
      const llmModel = await getRequiredAiModel(parsedLlmModelId, AiModelType.LLM);
      dataset.llmModelId = String(llmModel.id);
      dataset.llmModelName = llmModel.name;
      dataset.agentModel = llmModel.model;
    }
    if (chunkSize !== undefined) dataset.chunkSize = chunkSize;
    if (chunkSplitter !== undefined) dataset.chunkSplitter = chunkSplitter;
    if (qaPrompt !== undefined) dataset.qaPrompt = qaPrompt;
    if (avatar !== undefined) dataset.avatar = avatar;
    dataset.updateTime = new Date();

    await dataset.save();

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
      chunkSplitter: dataset.chunkSplitter,
      qaPrompt: dataset.qaPrompt,
      updateTime: dataset.updateTime,
    });
  } catch (error) {
    return handleApiError(error, "更新知识库失败");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireKnowledgePermission("knowledge:delete");
    const { id } = await params;

    const Dataset = await getDatasetModel();
    const dataset = await Dataset.findOne({
      _id: id,
      userId: user.userId,
      deleteTime: null,
    });

    if (!dataset) {
      throw new Error("NOT_FOUND");
    }

    dataset.deleteTime = new Date();
    dataset.updateTime = new Date();
    await dataset.save();

    const CollectionModel = await getDatasetCollectionModel();
    await CollectionModel.updateMany(
      { datasetId: id, userId: user.userId, deleteTime: null },
      { deleteTime: new Date(), updateTime: new Date() }
    );

    const DataModel = await getDatasetDataModel();
    const dataList = await DataModel.find({
      datasetId: id,
      userId: user.userId,
    }).lean();

    if (dataList.length > 0) {
      const vectorIds = dataList.flatMap((d: any) =>
        (d.indexes || []).map((idx: any) => idx.dataId)
      );

      if (vectorIds.length > 0) {
        await deleteVectors({
          teamId: user.userId,
          embeddingModelId: String(dataset.embeddingModelId || "default"),
          ids: vectorIds,
        });
      }
    }

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    return handleApiError(error, "删除知识库失败");
  }
}
