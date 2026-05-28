import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireWorkflowPermission } from "@/lib/auth/fastgpt-auth";
import { getAppModel } from "@/lib/models/app";

export async function GET(request: Request) {
  try {
    const user = await requireWorkflowPermission("workflow:read");

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const parentId = searchParams.get("parentId");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const cursor = searchParams.get("cursor");

    const App = await getAppModel();

    const query: Record<string, any> = {
      userId: user.userId,
      deleteTime: null,
    };

    if (type) {
      query.type = type;
    }

    if (parentId) {
      query.parentId = parentId;
    }

    if (cursor) {
      query.updateTime = { $lt: new Date(cursor) };
    }

    const list = await App.find(query)
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
        updateTime: item.updateTime,
      })),
      nextCursor,
    });
  } catch (error) {
    return handleApiError(error, "获取应用列表失败");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireWorkflowPermission("workflow:create");

    const body = await request.json();
    const { name, intro, type, parentId, avatar } = body;

    if (!name || !name.trim()) {
      throw new Error("应用名称不能为空");
    }

    if (!type || !["workflow", "folder"].includes(type)) {
      throw new Error("应用类型无效");
    }

    const App = await getAppModel();

    const app = await App.create({
      userId: user.userId,
      name: name.trim(),
      intro: intro || "",
      type,
      parentId: parentId || null,
      avatar: avatar || "/icon/logo.svg",
      modules: [],
      edges: [],
      chatConfig: {},
    });

    return NextResponse.json({
      id: app._id,
      name: app.name,
      type: app.type,
      avatar: app.avatar,
      intro: app.intro,
      updateTime: app.updateTime,
    });
  } catch (error) {
    return handleApiError(error, "创建应用失败");
  }
}
