import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { handleApiError } from "@/lib/api";
import { requireWorkflowPermission } from "@/lib/auth/fastgpt-auth";
import { getAppModel, getChatModel, getChatItemModel } from "@/lib/models/app";
import { runWorkflow, type RuntimeNode, type DispatchContext } from "@/lib/workflow/dispatch";
import { FlowNodeTypeEnum, type WorkflowNodeItemType } from "@/lib/workflow/constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireWorkflowPermission("workflow:debug");
    const { id } = await params;

    const body = await request.json();
    const { chatId, messages, variables = {}, modules, edges } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("消息不能为空");
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.obj !== "Human" || !lastMessage.value) {
      throw new Error("最后一条消息必须是用户消息");
    }

    const App = await getAppModel();

    const app = await App.findOne({
      _id: id,
      userId: user.userId,
      deleteTime: null,
    }).lean();

    if (!app) {
      throw new Error("NOT_FOUND");
    }

    const runtimeModules = Array.isArray(modules) && modules.length > 0 ? modules : app.modules || [];
    const runtimeEdges = Array.isArray(edges) ? edges : app.edges || [];

    const runtimeNodes: RuntimeNode[] = runtimeModules.map(
      (module: WorkflowNodeItemType) => ({
        ...module,
        isEntry: module.flowNodeType === FlowNodeTypeEnum.workflowStart,
        status: "running" as const,
      })
    );

    const ctx: DispatchContext = {
      userId: user.userId,
      appId: id,
      variables,
      histories: messages.slice(0, -1).map((m: { obj: string; value: string }) => ({
        obj: m.obj as "Human" | "AI",
        value: m.value,
      })),
      userChatInput: lastMessage.value,
      runtimeNodes,
      runtimeEdges,
    };

    const result = await runWorkflow(ctx);

    const Chat = await getChatModel();
    const ChatItem = await getChatItemModel();

    let chat;
    if (chatId) {
      chat = await Chat.findOne({
        _id: chatId,
        appId: id,
        userId: user.userId,
      });

      if (!chat) {
        chat = await Chat.create({
          appId: id,
          userId: user.userId,
          title: lastMessage.value.slice(0, 50),
          source: "test",
        });
      } else {
        await Chat.findByIdAndUpdate(chatId, {
          updateTime: new Date(),
        });
      }
    } else {
      chat = await Chat.create({
        appId: id,
        userId: user.userId,
        title: lastMessage.value.slice(0, 50),
        source: "test",
      });
    }

    await ChatItem.create({
      chatId: chat._id,
      userId: user.userId,
      appId: id,
      obj: "Human",
      value: lastMessage.value,
      time: new Date(),
    });

    await ChatItem.create({
      chatId: chat._id,
      userId: user.userId,
      appId: id,
      obj: "AI",
      value: result.outputText,
      responseData: result.nodeResponses,
      time: new Date(),
    });

    return NextResponse.json({
      chatId: chat._id,
      outputText: result.outputText,
      nodeResponses: result.nodeResponses,
      variables: result.variables,
    });
  } catch (error) {
    return handleApiError(error, "调试运行失败");
  }
}
