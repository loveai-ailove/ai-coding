import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireWorkflowPermission } from "@/lib/auth/fastgpt-auth";
import { getAppModel, getChatModel, getChatItemModel } from "@/lib/models/app";
import { runWorkflow, type DispatchContext } from "@/lib/workflow/dispatch";
import { FlowNodeTypeEnum, type WorkflowNodeItemType } from "@/lib/workflow/constants";
import type { RuntimeEdgeItemType } from "@/lib/workflow/types";
import { normalizeWorkflowModules } from "@/lib/workflow/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireWorkflowPermission("workflow:debug");
    const { id } = await params;

    const body = await request.json();
    const { chatId, messages, variables = {}, modules, edges, stream = false } = body;

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

    const runtimeModules: WorkflowNodeItemType[] = normalizeWorkflowModules(
      Array.isArray(modules) && modules.length > 0
        ? JSON.parse(JSON.stringify(modules))
        : JSON.parse(JSON.stringify(app.modules || []))
    ) as WorkflowNodeItemType[];

    const runtimeEdges: RuntimeEdgeItemType[] = (Array.isArray(edges) ? edges : app.edges || [])
      .map((e: any) => ({ ...e }));

    // Build runtime nodes with initial state
    const runtimeNodes = runtimeModules.map((module, idx) => ({
      nodeId: module.nodeId,
      name: module.name,
      intro: module.intro || "",
      flowNodeType: module.flowNodeType as FlowNodeTypeEnum,
      position: module.position || { x: 0, y: 0 },
      inputs: (module.inputs || []).map((input: any) => ({
        key: input.key,
        value: input.value,
        valueType: input.valueType,
        label: input.label,
        description: input.description,
        type: input.type,
        list: input.list,
        required: input.required,
        defaultValue: input.defaultValue,
        canEdit: input.canEdit,
        editField: input.editField,
        renderTypeList: input.renderTypeList,
        connected: input.connected,
        showTargetInApp: input.showTargetInApp,
        showTargetInPlugin: input.showTargetInPlugin,
        placeholder: input.placeholder,
        maxLength: input.maxLength,
        min: input.min,
        max: input.max,
        customInputConfig: input.customInputConfig,
        dynamicParamDefaultValue: input.dynamicParamDefaultValue,
        md: input.md,
        mist: input.mist,
      })),
      outputs: (module.outputs || []).map((output: any) => ({
        key: output.key,
        label: output.label || output.key,
        description: output.description,
        valueType: output.valueType,
        type: output.type,
        list: output.list,
        targets: output.targets,
        defaultValue: output.defaultValue,
        required: output.required,
      })),
      showStatus: module.showStatus !== false,
      version: module.version,
      catchError: module.catchError || false,
      avatar: module.avatar,
    }));

    // If streaming is requested, use SSE
    if (stream) {
      const encoder = new TextEncoder();
      const streamResponse = new ReadableStream({
        async start(controller) {
          // Helper to send SSE event
          const sendEvent = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };
          
          const ctx: DispatchContext = {
            userId: user.userId,
            appId: id,
            variables: { ...variables },
            variableRecord: {},
            histories: messages.slice(0, -1).map((m: { obj: string; value: string }) => ({
              obj: m.obj as "Human" | "AI",
              value: m.value,
            })),
            userChatInput: lastMessage.value,
            query: lastMessage.value,
            runtimeNodes,
            runtimeEdges,
            mode: "debug",
            isRootRuntime: true,
            chatConfig: app.chatConfig || {},
            streamCallback: sendEvent,
          };
          
          try {
            sendEvent("start", { message: "开始执行工作流" });
            
            const result = await runWorkflow(ctx);
            
            // Save to database
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
                await Chat.findByIdAndUpdate(chatId, { updateTime: new Date() });
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
            
            // Send final result
            sendEvent("done", {
              chatId: chat._id,
              outputText: result.outputText,
              nodeResponses: result.nodeResponses,
              variables: result.variables,
              memoryNodes: result.memoryNodes,
              memoryEdges: result.memoryEdges,
              entryNodeIds: result.entryNodeIds,
              debugNodeResponses: result.debugNodeResponses,
              skipNodeQueue: result.skipNodeQueue,
              interactiveResponse: result.interactiveResponse,
              executionLogs: result.executionLogs,
              nodeSnapshots: result.nodeSnapshots,
            });
          } catch (error) {
            sendEvent("error", { error: error instanceof Error ? error.message : "执行失败" });
          } finally {
            controller.close();
          }
        },
      });
      
      return new Response(streamResponse, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }
    
    // Non-streaming response (original behavior)
    const ctx: DispatchContext = {
      userId: user.userId,
      appId: id,
      variables: { ...variables },
      variableRecord: {},
      histories: messages.slice(0, -1).map((m: { obj: string; value: string }) => ({
        obj: m.obj as "Human" | "AI",
        value: m.value,
      })),
      userChatInput: lastMessage.value,
      query: lastMessage.value,
      runtimeNodes,
      runtimeEdges,
      mode: "debug",
      isRootRuntime: true,
      chatConfig: app.chatConfig || {},
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
      memoryNodes: result.memoryNodes,
      memoryEdges: result.memoryEdges,
      entryNodeIds: result.entryNodeIds,
      debugNodeResponses: result.debugNodeResponses,
      skipNodeQueue: result.skipNodeQueue,
      interactiveResponse: result.interactiveResponse,
      executionLogs: result.executionLogs,
      nodeSnapshots: result.nodeSnapshots,
    });
  } catch (error) {
    return handleApiError(error, "调试运行失败");
  }
}
