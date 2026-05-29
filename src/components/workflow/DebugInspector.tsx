"use client";

import { useState, useRef, useEffect } from "react";

interface NodeSnapshot {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "run" | "skip" | "wait" | "error";
  resolvedInputs: Record<string, any>;
  outputs: Record<string, any>;
  runningTime?: number;
  error?: string;
  timestamp: string;
}

interface ExecutionLog {
  nodeId: string;
  moduleName?: string;
  moduleType?: string;
  status: "queued" | "run" | "skip" | "wait" | "error" | "interactive";
  message?: string;
  timestamp: string;
  detail?: Record<string, any>;
}

interface Message {
  obj: "Human" | "AI";
  value: string;
  nodeSnapshots?: NodeSnapshot[];
}

interface DebugInspectorProps {
  appId: string;
  nodes: any[];
  edges: any[];
  onHighlightNode?: (nodeId: string | null) => void;
  onShowNodeDetail?: (snapshots: NodeSnapshot[]) => void;
}

function safeRender(value: any): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    run: "bg-green-100 text-green-700",
    skip: "bg-gray-100 text-gray-500",
    wait: "bg-yellow-100 text-yellow-700",
    error: "bg-red-100 text-red-700",
    interactive: "bg-orange-100 text-orange-700",
  };
  return map[status] || "bg-gray-100 text-gray-500";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    run: "执行",
    skip: "跳过",
    wait: "等待",
    error: "错误",
    interactive: "交互",
  };
  return map[status] || status;
}

function formatValue(value: any, maxLen = 80): string {
  const text = safeRender(value);
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

function NodeSnapshotCard({ snapshot, onClick, onShowDetail }: { snapshot: NodeSnapshot; onClick?: () => void; onShowDetail?: (snapshots: NodeSnapshot[]) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white text-xs"
      onClick={() => { setExpanded(!expanded); onClick?.(); }}
    >
      <div className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadge(snapshot.status)}`}>
            {statusLabel(snapshot.status)}
          </span>
          <span className="truncate font-medium text-gray-800">{snapshot.nodeName}</span>
          <span className="text-gray-400">{snapshot.nodeType}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400 shrink-0">
          {snapshot.runningTime != null && <span>{snapshot.runningTime}s</span>}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowDetail?.([snapshot]);
            }}
            className="rounded px-1.5 py-0.5 text-[10px] text-blue-500 hover:bg-blue-50 hover:text-blue-700"
          >
            详情
          </button>
          <svg className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 space-y-2 p-3">
          {snapshot.error && (
            <div className="rounded bg-red-50 p-2 text-red-600">{snapshot.error}</div>
          )}
          <div>
            <div className="mb-1 font-medium text-gray-500">输入参数</div>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded bg-gray-50 p-2 font-mono">
              {Object.keys(snapshot.resolvedInputs).length === 0 && (
                <span className="text-gray-400">(无)</span>
              )}
              {Object.entries(snapshot.resolvedInputs).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="shrink-0 text-blue-600">{key}</span>
                  <span className="text-gray-600 break-all">{formatValue(value, 100)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 font-medium text-gray-500">输出结果</div>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded bg-gray-50 p-2 font-mono">
              {Object.keys(snapshot.outputs).length === 0 && (
                <span className="text-gray-400">(无)</span>
              )}
              {Object.entries(snapshot.outputs).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="shrink-0 text-purple-600">{key}</span>
                  <span className="text-gray-600 break-all">{formatValue(value, 100)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DebugInspector({
  appId,
  nodes,
  edges,
  onHighlightNode,
  onShowNodeDetail,
}: DebugInspectorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 监听清空消息的自定义事件
  useEffect(() => {
    const handleClearEvent = () => {
      setMessages([]);
      setChatId(null);
      onHighlightNode?.(null);
    };

    window.addEventListener('clearDebugMessages', handleClearEvent);
    return () => {
      window.removeEventListener('clearDebugMessages', handleClearEvent);
    };
  }, [onHighlightNode]);

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
        const interactiveText = data.interactiveResponse
          ? `等待交互: ${data.interactiveResponse.type === "formInput" ? "表单输入" : data.interactiveResponse.type === "userSelect" ? "用户选择" : "继续处理"}`
          : "（无输出）";
        const newIdx = newMessages.length;
        setMessages((prev) => [
          ...prev,
          {
            obj: "AI",
            value: data.outputText || interactiveText,
            nodeSnapshots: data.nodeSnapshots,
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

  return (
    <div className="flex h-full">
      <div className="flex w-full h-full flex-col bg-white">
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
                {msg.nodeSnapshots && msg.nodeSnapshots.length > 0 && (
                  <button
                    onClick={() => {
                      if (onShowNodeDetail) {
                        onShowNodeDetail(msg.nodeSnapshots);
                      }
                    }}
                    className="mt-2 text-xs text-blue-500 hover:text-blue-700"
                  >
                    查看节点详情 ({msg.nodeSnapshots.length} 个节点)
                  </button>
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
        <div className="p-3">
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
    </div>
  );
}
