"use client";

import { useState, useRef, useEffect } from "react";
import { MarkdownMessage } from "./MarkdownMessage";
import { readSSEStream } from "./sse";

interface Message {
  obj: "Human" | "AI";
  value: string;
  thinking?: string;
  nodeResponses?: any[];
  interactiveResponse?: any;
  executionLogs?: any[];
}

function getFinalMessageText(finalData: any, streamingAnswer: string, thinking: string) {
  if (finalData?.outputText) return finalData.outputText;
  if (streamingAnswer) return streamingAnswer;
  if (finalData?.interactiveResponse) {
    return `等待交互: ${finalData.interactiveResponse.type === "formInput" ? "表单输入" : finalData.interactiveResponse.type === "userSelect" ? "用户选择" : "继续处理"}`;
  }
  if (thinking) {
    return "模型未返回最终回答，仅返回了思考内容。";
  }
  return "（无输出）";
}

export function ChatTestPanel({
  appId,
  nodes,
  edges,
}: {
  appId: string;
  nodes: any[];
  edges: any[];
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [streamingThinking, setStreamingThinking] = useState("");
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingThinking, streamingAnswer]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages = [...messages, { obj: "Human" as const, value: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    setStreamingThinking("");
    setStreamingAnswer("");

    try {
      const res = await fetch(`/api/workflow/app/${appId}/debug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          messages: newMessages.map((m) => ({ obj: m.obj, value: m.value })),
          variables: {},
          modules: nodes,
          edges,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "请求失败" }));
        setMessages((prev) => [...prev, { obj: "AI", value: `错误: ${err.error}` }]);
        return;
      }

      // Handle SSE stream
      const stream = res.body;
      if (!stream) throw new Error("No response body");
      let finalData: any = null;

      await readSSEStream(stream, (event, data) => {
        switch (event) {
          case "thinking":
            setStreamingThinking((prev) => prev + (data.content || ""));
            break;
          case "answer":
            setStreamingAnswer((prev) => prev + (data.content || ""));
            break;
          case "done":
            finalData = data;
            break;
          case "error":
            setMessages((prev) => [...prev, { obj: "AI", value: `错误: ${data.error}` }]);
            break;
        }
      });

      // Process final result
      if (finalData) {
        // Get thinking from nodeSnapshots if available
        const chatNodeSnapshot = finalData.nodeSnapshots?.find(
          (s: any) => s.nodeType === "chatNode" || s.nodeType === "agent"
        );
        const thinking = chatNodeSnapshot?.llmResponse?.thinking || streamingThinking;
        const messageText = getFinalMessageText(finalData, streamingAnswer, thinking);
        
        setMessages((prev) => [
          ...prev,
          {
            obj: "AI",
            value: messageText,
            thinking: thinking || undefined,
            nodeResponses: finalData.nodeResponses,
            interactiveResponse: finalData.interactiveResponse,
            executionLogs: finalData.executionLogs,
          },
        ]);
        if (finalData.chatId) setChatId(finalData.chatId);
      }
    } catch {
      setMessages((prev) => [...prev, { obj: "AI", value: "网络错误" }]);
    } finally {
      setLoading(false);
      setStreamingThinking("");
      setStreamingAnswer("");
    }
  };

  const handleClear = () => {
    setMessages([]);
    setChatId(null);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-900">调试对话</h3>
        <button onClick={handleClear} className="text-xs text-gray-400 hover:text-gray-600">清空</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="py-8 text-center text-sm text-gray-400">发送消息测试工作流</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.obj === "Human" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.obj === "Human"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-800"
            }`}>
              {/* Thinking process */}
              {msg.thinking && (
                <details className="mb-2">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    思考过程
                  </summary>
                  <div className="mt-1 whitespace-pre-wrap text-xs text-gray-500 italic">
                    {msg.thinking}
                  </div>
                </details>
              )}
              {msg.obj === "Human" ? (
                <div className="whitespace-pre-wrap">{msg.value}</div>
              ) : (
                <MarkdownMessage content={msg.value} />
              )}
              {msg.nodeResponses && msg.nodeResponses.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <div className="text-xs text-gray-400 mb-1">执行节点:</div>
                  {msg.nodeResponses.map((nr: any, j: number) => (
                    <div key={j} className="text-xs text-gray-500">
                      {nr.error ? "❌" : "✅"} {nr.moduleName || nr.moduleType || nr.nodeType || "未知节点"}
                      {nr.error && <span className="text-red-400"> - {nr.error}</span>}
                    </div>
                  ))}
                </div>
              )}
              {msg.interactiveResponse && (
                <div className="mt-2 rounded-md bg-white/70 p-2 text-xs text-gray-600">
                  <div className="font-medium text-gray-700">交互节点已暂停</div>
                  <div className="mt-1">
                    类型: {msg.interactiveResponse.type === "formInput" ? "表单输入" : "用户选择"}
                  </div>
                  {msg.interactiveResponse.params?.description && (
                    <div className="mt-1 whitespace-pre-wrap">{msg.interactiveResponse.params.description}</div>
                  )}
                </div>
              )}
              {msg.executionLogs && msg.executionLogs.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <div className="mb-1 text-xs text-gray-400">执行日志:</div>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-md bg-white/70 p-2">
                    {msg.executionLogs.map((log: any, index: number) => (
                      <div key={index} className="text-xs text-gray-600">
                        [{log.status}] {log.moduleName || log.nodeId}
                        {log.message ? ` - ${log.message}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {/* Streaming output */}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
              {streamingThinking && (
                <details className="mb-2" open>
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    思考中...
                  </summary>
                  <div className="mt-1 whitespace-pre-wrap text-xs text-gray-500 italic">
                    {streamingThinking}
                  </div>
                </details>
              )}
              {streamingAnswer ? (
                <MarkdownMessage content={streamingAnswer} />
              ) : !streamingThinking ? (
                <span className="inline-block animate-pulse">思考中...</span>
              ) : null}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="输入消息..."
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
