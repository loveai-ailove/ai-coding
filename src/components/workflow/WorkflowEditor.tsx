"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FlowCanvas } from "./Flow";
import { ChatTestPanel } from "./ChatTest";

interface AppDetail {
  id: string;
  name: string;
  intro: string;
  modules: any[];
  edges: any[];
  chatConfig: Record<string, any>;
}

export function WorkflowEditor({ appId }: { appId: string }) {
  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/workflow/app/${appId}`);
      if (res.ok) {
        const data = await res.json();
        setApp(data);
        setNodes(data.modules || []);
        setEdges(data.edges || []);
      }
      setLoading(false);
    })();
  }, [appId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/workflow/app/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: nodes, edges }),
      });
      if (!res.ok) {
        alert("保存失败");
        return false;
      }

      const updatedApp = await res.json();
      setApp(updatedApp);
      setNodes(updatedApp.modules || []);
      setEdges(updatedApp.edges || []);
      return true;
    } finally {
      setSaving(false);
    }
  }, [appId, nodes, edges]);

  const handlePublish = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) {
      return;
    }

    const versionName = `v${Date.now()}`;
    const res = await fetch(`/api/workflow/app/${appId}/version`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        versionName,
        modules: nodes,
        edges,
        chatConfig: app?.chatConfig || {},
      }),
    });
    if (res.ok) alert("发布成功");
    else alert("发布失败");
  }, [app?.chatConfig, appId, edges, handleSave, nodes]);

  if (loading) return <div className="flex h-full items-center justify-center text-gray-400">加载中...</div>;
  if (!app) return <div className="flex h-full items-center justify-center text-gray-400">工作流不存在</div>;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/workflow" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">{app.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDebug((v) => !v)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {showDebug ? "关闭调试" : "调试运行"}
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
          <button onClick={handlePublish} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">发布版本</button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <FlowCanvas nodes={nodes} edges={edges} onNodesChange={setNodes} onEdgesChange={setEdges} />
        </div>
        {showDebug && (
          <div className="w-96 border-l border-gray-200">
            <ChatTestPanel appId={appId} nodes={nodes} edges={edges} />
          </div>
        )}
      </div>
    </div>
  );
}
