import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireWorkflowPermission } from "@/lib/auth/fastgpt-auth";
import { getAppModel } from "@/lib/models/app";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireWorkflowPermission("workflow:read");
    const { id } = await params;

    const App = await getAppModel();

    const app = await App.findOne({
      _id: id,
      userId: user.userId,
      deleteTime: null,
    }).lean();

    if (!app) {
      throw new Error("NOT_FOUND");
    }

    return NextResponse.json({
      id: app._id,
      name: app.name,
      type: app.type,
      avatar: app.avatar,
      intro: app.intro,
      modules: app.modules,
      edges: app.edges,
      chatConfig: app.chatConfig,
      updateTime: app.updateTime,
    });
  } catch (error) {
    return handleApiError(error, "获取应用详情失败");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireWorkflowPermission("workflow:update");
    const { id } = await params;

    const body = await request.json();
    const { name, intro, modules, edges, chatConfig, avatar } = body;

    const App = await getAppModel();

    const app = await App.findOne({
      _id: id,
      userId: user.userId,
      deleteTime: null,
    });

    if (!app) {
      throw new Error("NOT_FOUND");
    }

    const updateData: Record<string, any> = {
      updateTime: new Date(),
    };

    if (name !== undefined) {
      if (!name.trim()) {
        throw new Error("应用名称不能为空");
      }
      updateData.name = name.trim();
    }

    if (intro !== undefined) {
      updateData.intro = intro;
    }

    if (modules !== undefined) {
      updateData.modules = modules;
    }

    if (edges !== undefined) {
      updateData.edges = edges;
    }

    if (chatConfig !== undefined) {
      updateData.chatConfig = chatConfig;
    }

    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }

    const updatedApp = await App.findByIdAndUpdate(id, updateData, { new: true }).lean();

    return NextResponse.json({
      id: updatedApp!._id,
      name: updatedApp!.name,
      type: updatedApp!.type,
      avatar: updatedApp!.avatar,
      intro: updatedApp!.intro,
      modules: updatedApp!.modules,
      edges: updatedApp!.edges,
      chatConfig: updatedApp!.chatConfig,
      updateTime: updatedApp!.updateTime,
    });
  } catch (error) {
    return handleApiError(error, "更新应用失败");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireWorkflowPermission("workflow:delete");
    const { id } = await params;

    const App = await getAppModel();

    const app = await App.findOne({
      _id: id,
      userId: user.userId,
      deleteTime: null,
    });

    if (!app) {
      throw new Error("NOT_FOUND");
    }

    await App.findByIdAndUpdate(id, {
      deleteTime: new Date(),
      updateTime: new Date(),
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    return handleApiError(error, "删除应用失败");
  }
}
