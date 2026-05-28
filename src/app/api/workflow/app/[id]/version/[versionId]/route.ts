import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireWorkflowPermission } from "@/lib/auth/fastgpt-auth";
import { getAppModel, getWorkflowVersionModel } from "@/lib/models/app";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const user = await requireWorkflowPermission("workflow:read");
    const { id, versionId } = await params;

    const App = await getAppModel();
    const WorkflowVersion = await getWorkflowVersionModel();

    const app = await App.findOne({
      _id: id,
      userId: user.userId,
      deleteTime: null,
    }).lean();

    if (!app) {
      throw new Error("NOT_FOUND");
    }

    const version = await WorkflowVersion.findOne({
      _id: versionId,
      appId: id,
    }).lean();

    if (!version) {
      throw new Error("版本不存在");
    }

    return NextResponse.json({
      id: version._id,
      versionName: version.versionName,
      modules: version.modules,
      edges: version.edges,
      chatConfig: version.chatConfig,
      publishTime: version.publishTime,
      createTime: version.createTime,
    });
  } catch (error) {
    return handleApiError(error, "获取版本详情失败");
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const user = await requireWorkflowPermission("workflow:update");
    const { id, versionId } = await params;

    const App = await getAppModel();
    const WorkflowVersion = await getWorkflowVersionModel();

    const app = await App.findOne({
      _id: id,
      userId: user.userId,
      deleteTime: null,
    });

    if (!app) {
      throw new Error("NOT_FOUND");
    }

    const version = await WorkflowVersion.findOne({
      _id: versionId,
      appId: id,
    }).lean();

    if (!version) {
      throw new Error("版本不存在");
    }

    await App.findByIdAndUpdate(id, {
      modules: version.modules,
      edges: version.edges,
      chatConfig: version.chatConfig,
      updateTime: new Date(),
    });

    return NextResponse.json({
      message: "版本切换成功",
      app: {
        id: app._id,
        modules: version.modules,
        edges: version.edges,
        chatConfig: version.chatConfig,
      },
    });
  } catch (error) {
    return handleApiError(error, "切换版本失败");
  }
}
