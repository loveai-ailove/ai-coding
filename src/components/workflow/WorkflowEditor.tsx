"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FlowCanvas } from "./Flow";
import { DebugInspector } from "./DebugInspector";

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
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<any>(null);
  const [expandedApiRequests, setExpandedApiRequests] = useState<Record<string, boolean>>({});

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
    <div className="relative flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
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
          <FlowCanvas nodes={nodes} edges={edges} onNodesChange={setNodes} onEdgesChange={setEdges} highlightNodeId={highlightNodeId} />
        </div>
      </div>

      {/* 遮罩层 */}
      {showDebug && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-300"
          onClick={() => setShowDebug(false)}
        />
      )}

      {/* 从右侧滑出的调试面板 */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-[460px] flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          showDebug ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 面板头部 */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
            </svg>
            <span className="text-base font-semibold text-gray-900">调试运行</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // 清空消息的逻辑会通过 ref 或回调传递给 DebugInspector
                const event = new CustomEvent('clearDebugMessages');
                window.dispatchEvent(event);
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            >
              清空
            </button>
            <button
              onClick={() => setShowDebug(false)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 面板内容 */}
        <div className="flex-1 overflow-hidden">
          <DebugInspector
            appId={appId}
            nodes={nodes}
            edges={edges}
            onHighlightNode={setHighlightNodeId}
            onShowNodeDetail={setSelectedNodeDetail}
          />
        </div>
      </div>

      {/* 节点详情弹窗 */}
      {selectedNodeDetail && selectedNodeDetail.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="relative w-[700px] max-h-[85vh] overflow-auto rounded-xl bg-white shadow-2xl">
            {/* 弹窗头部 */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">节点详情 ({selectedNodeDetail.length} 个节点)</h2>
              <button
                onClick={() => setSelectedNodeDetail(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 节点列表 */}
            <div className="space-y-4 p-6">
              {selectedNodeDetail.map((snapshot: any, index: number) => (
                <div key={`${snapshot.nodeId}-${index}`} className="rounded-lg border border-gray-200">
                  {/* 节点头部 */}
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        snapshot.status === 'run' ? 'bg-green-100 text-green-700' :
                        snapshot.status === 'error' ? 'bg-red-100 text-red-700' :
                        snapshot.status === 'skip' ? 'bg-gray-100 text-gray-500' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {snapshot.status === 'run' ? '执行' : snapshot.status === 'error' ? '错误' : snapshot.status === 'skip' ? '跳过' : '等待'}
                      </span>
                      <span className="font-medium text-gray-900">{snapshot.nodeName}</span>
                      <span className="text-sm text-gray-500">{snapshot.nodeType}</span>
                    </div>
                    {snapshot.runningTime != null && (
                      <span className="text-sm text-gray-500">{snapshot.runningTime}s</span>
                    )}
                  </div>
                  
                  {/* 节点内容 */}
                  <div className="p-4">
                    {snapshot.error && (
                      <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{snapshot.error}</div>
                    )}
                    
                    {/* 输入参数 */}
                    <div className="mb-3">
                      <h4 className="mb-2 text-sm font-medium text-gray-700">输入参数</h4>
                      <div className="rounded-lg bg-gray-50 p-3">
                        {Object.keys(snapshot.resolvedInputs || {}).length === 0 ? (
                          <span className="text-sm text-gray-400">(无)</span>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(snapshot.resolvedInputs || {}).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex gap-2 text-sm">
                                <span className="shrink-0 font-medium text-blue-600">{key}:</span>
                                <span className="break-all text-gray-600">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* LLM 请求参数 - 仅对 AI 节点显示 */}
                    {snapshot.llmRequest && (
                      <div className="mb-3">
                        <h4 className="mb-2 text-sm font-medium text-gray-700">LLM 请求参数</h4>
                        <pre className="max-h-[500px] overflow-y-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400">
                          {JSON.stringify(snapshot.llmRequest, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* API 请求详情 */}
                    {snapshot.apiRequests && snapshot.apiRequests.length > 0 && (
                      <div className="mb-3">
                        <h4 className="mb-2 text-sm font-medium text-gray-700">API 请求详情</h4>
                        <div className="space-y-3">
                          {snapshot.apiRequests.map((req: any, idx: number) => {
                            const reqKey = `${snapshot.nodeId}-${idx}`;
                            const isExpanded = expandedApiRequests[reqKey];
                            return (
                              <div key={idx} className="rounded-lg border border-gray-200">
                                <div 
                                  className="flex cursor-pointer items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2 hover:bg-gray-100"
                                  onClick={() => setExpandedApiRequests(prev => ({ ...prev, [reqKey]: !prev[reqKey] }))}
                                >
                                  <div className="flex items-center gap-2">
                                    <svg 
                                      className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                                      fill="none" 
                                      viewBox="0 0 24 24" 
                                      strokeWidth={1.5} 
                                      stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                      req.type === 'llm' ? 'bg-blue-100 text-blue-700' :
                                      req.type === 'embedding' ? 'bg-purple-100 text-purple-700' :
                                      req.type === 'vector_search' ? 'bg-indigo-100 text-indigo-700' :
                                      req.type === 'database' ? 'bg-orange-100 text-orange-700' :
                                      req.type === 'http' ? 'bg-green-100 text-green-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {req.type}
                                    </span>
                                    <span className="text-sm font-medium text-gray-800">{req.name}</span>
                                    {req.url && !isExpanded && (
                                      <span className="text-xs text-gray-500 truncate max-w-[200px]">{req.url}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {req.duration != null && (
                                      <span className="text-xs text-gray-500">{req.duration}s</span>
                                    )}
                                    <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                                      req.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {req.status}
                                    </span>
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="p-3">
                                    {/* 请求信息 */}
                                    {req.url && (
                                      <div className="mb-2">
                                        <span className="text-xs font-medium text-gray-500">URL:</span>
                                        <span className="ml-2 break-all text-xs text-gray-700">{req.method} {req.url}</span>
                                      </div>
                                    )}
                                    {req.headers && Object.keys(req.headers).length > 0 && (
                                      <div className="mb-2">
                                        <span className="text-xs font-medium text-gray-500">Headers:</span>
                                        <pre className="mt-1 max-h-[100px] overflow-y-auto rounded bg-gray-100 p-2 text-xs text-gray-600">
                                          {JSON.stringify(req.headers, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    {req.body && (
                                      <div className="mb-2">
                                        <span className="text-xs font-medium text-gray-500">请求体:</span>
                                        <pre className="mt-1 max-h-[200px] overflow-y-auto rounded bg-gray-100 p-2 text-xs text-gray-600">
                                          {JSON.stringify(req.body, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    {req.response && (
                                      <div className="mb-2">
                                        <span className="text-xs font-medium text-gray-500">响应:</span>
                                        <pre className="mt-1 max-h-[200px] overflow-y-auto rounded bg-gray-100 p-2 text-xs text-gray-600">
                                          {JSON.stringify(req.response, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    {req.error && (
                                      <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">
                                        错误: {req.error}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 输出结果 */}
                    <div className="mb-3">
                      <h4 className="mb-2 text-sm font-medium text-gray-700">输出结果</h4>
                      <div className="rounded-lg bg-gray-50 p-3">
                        {Object.keys(snapshot.outputs || {}).length === 0 ? (
                          <span className="text-sm text-gray-400">(无)</span>
                        ) : (
                          <div className="space-y-1">
                            {Object.entries(snapshot.outputs || {}).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex gap-2 text-sm">
                                <span className="shrink-0 font-medium text-purple-600">{key}:</span>
                                <span className="break-all text-gray-600">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
