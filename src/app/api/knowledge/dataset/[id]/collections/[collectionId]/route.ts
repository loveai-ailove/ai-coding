import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireKnowledgePermission } from "@/lib/auth/fastgpt-auth";
import { getDatasetModel, getDatasetCollectionModel, getDatasetDataModel } from "@/lib/models/dataset";
import { deleteVectors } from "@/lib/infra/milvus";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; collectionId: string }> }
) {
  try {
    const user = await requireKnowledgePermission("knowledge:read");
    const { id: datasetId, collectionId } = await params;

    const Dataset = await getDatasetModel();
    const dataset = await Dataset.findOne({
      _id: datasetId,
      userId: user.userId,
      deleteTime: null,
    }).lean();

    if (!dataset) {
      throw new Error("NOT_FOUND");
    }

    const CollectionModel = await getDatasetCollectionModel();
    const collection = await CollectionModel.findOne({
      _id: collectionId,
      datasetId,
      userId: user.userId,
      deleteTime: null,
    }).lean();

    if (!collection) {
      throw new Error("NOT_FOUND");
    }

    const DataModel = await getDatasetDataModel();
    const dataCount = await DataModel.countDocuments({
      collectionId,
      datasetId,
      userId: user.userId,
    });

    return NextResponse.json({
      id: collection._id,
      datasetId: collection.datasetId,
      name: collection.name,
      type: collection.type,
      tags: collection.tags,
      rawLink: collection.rawLink,
      rawTextLength: collection.rawTextLength,
      hashRawText: collection.hashRawText,
      metadata: collection.metadata,
      createTime: collection.createTime,
      updateTime: collection.updateTime,
      forbid: collection.forbid,
      dataCount,
    });
  } catch (error) {
    return handleApiError(error, "获取集合详情失败");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; collectionId: string }> }
) {
  try {
    const user = await requireKnowledgePermission("knowledge:delete");
    const { id: datasetId, collectionId } = await params;

    const Dataset = await getDatasetModel();
    const dataset = await Dataset.findOne({
      _id: datasetId,
      userId: user.userId,
      deleteTime: null,
    }).lean();

    if (!dataset) {
      throw new Error("NOT_FOUND");
    }

    const CollectionModel = await getDatasetCollectionModel();
    const collection = await CollectionModel.findOne({
      _id: collectionId,
      datasetId,
      userId: user.userId,
      deleteTime: null,
    });

    if (!collection) {
      throw new Error("NOT_FOUND");
    }

    collection.deleteTime = new Date();
    collection.updateTime = new Date();
    await collection.save();

    const DataModel = await getDatasetDataModel();
    const dataList = await DataModel.find({
      collectionId,
      datasetId,
      userId: user.userId,
    }).lean();

    const vectorIds = dataList.flatMap((d: any) =>
      (d.indexes || []).map((idx: any) => idx.dataId)
    );

    if (vectorIds.length > 0) {
      await deleteVectors({
        teamId: user.userId,
        ids: vectorIds,
      });
    }

    await DataModel.deleteMany({
      collectionId,
      datasetId,
      userId: user.userId,
    });

    await Dataset.updateOne(
      { _id: datasetId },
      { updateTime: new Date() }
    );

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    return handleApiError(error, "删除集合失败");
  }
}
