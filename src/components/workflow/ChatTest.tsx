"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  obj: "Human" | "AI";
  value: string;
  nodeResponses?: any[];
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newMessages = [...messages, { obj: "Human" as const, value: userMsg }];
    setMessages(newMessages);
    setLoading(true);

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
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            obj: "AI",
            value: data.outputText || "（无输出）",
            nodeResponses: data.nodeResponses,
          },
        ]);
        if (data.chatId) setChatId(data.chatId);
      } else {
        const err = await res.json().catch(() => ({ error: "请求失败" }));
        setMessages((prev) => [...prev, { obj: "AI", value: `错误: ${err.error}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { obj: "AI", value: "网络错误" }]);
    } finally {
      setLoading(false);
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
        {messages.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">发送消息测试工作流</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.obj === "Human" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.obj === "Human"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-800"
            }`}>
              <div className="whitespace-pre-wrap">{msg.value}</div>
              {msg.nodeResponses && msg.nodeResponses.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2">
                  <div className="text-xs text-gray-400 mb-1">执行节点:</div>
                  {msg.nodeResponses.map((nr: any, j: number) => (
                    <div key={j} className="text-xs text-gray-500">
                      ✅ {nr.nodeType}
                      {nr.responseData?.error && <span className="text-red-400"> - {nr.responseData.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
              <span className="inline-block animate-pulse">思考中...</span>
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
