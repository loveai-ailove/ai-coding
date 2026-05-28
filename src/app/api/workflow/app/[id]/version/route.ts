import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireWorkflowPermission } from "@/lib/auth/fastgpt-auth";
import { getAppModel, getWorkflowVersionModel } from "@/lib/models/app";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireWorkflowPermission("workflow:read");
    const { id } = await params;

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

    const versions = await WorkflowVersion.find({ appId: id })
      .sort({ publishTime: -1 })
      .lean();

    return NextResponse.json({
      list: versions.map((v) => ({
        id: v._id,
        versionName: v.versionName,
        publishTime: v.publishTime,
        createTime: v.createTime,
      })),
    });
  } catch (error) {
    return handleApiError(error, "获取版本列表失败");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireWorkflowPermission("workflow:update");
    const { id } = await params;

    const body = await request.json();
    const { versionName, modules, edges, chatConfig } = body;

    if (!versionName || !versionName.trim()) {
      throw new Error("版本名称不能为空");
    }

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

    const nextModules = modules !== undefined ? modules : app.modules;
    const nextEdges = edges !== undefined ? edges : app.edges;
    const nextChatConfig = chatConfig !== undefined ? chatConfig : app.chatConfig;

    await App.findByIdAndUpdate(id, {
      modules: nextModules,
      edges: nextEdges,
      chatConfig: nextChatConfig,
      updateTime: new Date(),
    });

    const version = await WorkflowVersion.create({
      appId: id,
      userId: user.userId,
      versionName: versionName.trim(),
      modules: nextModules,
      edges: nextEdges,
      chatConfig: nextChatConfig,
    });

    return NextResponse.json({
      id: version._id,
      versionName: version.versionName,
      publishTime: version.publishTime,
      createTime: version.createTime,
    });
  } catch (error) {
    return handleApiError(error, "发布版本失败");
  }
}
