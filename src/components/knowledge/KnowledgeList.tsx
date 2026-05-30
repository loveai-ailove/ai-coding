"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Dataset {
  id: string;
  name: string;
  intro: string;
  type: string;
  embeddingModelId?: string;
  embeddingModelName?: string;
  embeddingDimension?: number;
  llmModelId?: string;
  llmModelName?: string;
  vectorModel: string;
  agentModel: string;
  updateTime: string;
}

interface ModelOption {
  id: string;
  name: string;
  model: string;
  embeddingDimension?: number | null;
}

export function KnowledgeList() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<ModelOption[]>([]);
  const [llmModels, setLlmModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [datasetRes, embeddingRes, llmRes] = await Promise.all([
        fetch("/api/knowledge/dataset?pageSize=50"),
        fetch("/api/ai/models?type=EMBEDDING"),
        fetch("/api/ai/models?type=LLM"),
      ]);
      const [datasetData, embeddingData, llmData] = await Promise.all([
        datasetRes.json(),
        embeddingRes.json(),
        llmRes.json(),
      ]);
      if (!datasetRes.ok) {
        throw new Error(datasetData.error || "获取知识库列表失败");
      }
      if (!embeddingRes.ok) {
        throw new Error(embeddingData.error || "获取嵌入模型失败");
      }
      if (!llmRes.ok) {
        throw new Error(llmData.error || "获取语言模型失败");
      }
      setDatasets(Array.isArray(datasetData?.list) ? datasetData.list : []);
      setEmbeddingModels(Array.isArray(embeddingData?.list) ? embeddingData.list : []);
      setLlmModels(Array.isArray(llmData?.list) ? llmData.list : []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "获取知识库列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDatasets(); }, [fetchDatasets]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除知识库"${name}"吗？`)) return;
    const res = await fetch(`/api/knowledge/dataset/${id}`, { method: "DELETE" });
    if (res.ok) fetchDatasets();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">知识库管理</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + 创建知识库
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">加载中...</div>
      ) : datasets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-400">暂无知识库</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 text-sm text-blue-600 hover:underline">创建第一个知识库</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((ds) => (
            <Link key={ds.id} href={`/admin/knowledge/${ds.id}`} className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
                </div>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(ds.id, ds.name); }} className="rounded p-1 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500" title="删除">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                </button>
              </div>
              <h3 className="mt-3 text-base font-semibold text-gray-900">{ds.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{ds.intro || "暂无简介"}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <span className="rounded bg-gray-100 px-1.5 py-0.5">{ds.embeddingModelName || ds.vectorModel}</span>
                {ds.embeddingDimension ? (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5">{ds.embeddingDimension} 维</span>
                ) : null}
                <span>{new Date(ds.updateTime).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

      {showCreate && (
        <CreateDatasetModal
          embeddingModels={embeddingModels}
          llmModels={llmModels}
          onClose={() => setShowCreate(false)}
          onSuccess={fetchDatasets}
        />
      )}
    </div>
  );
}

function CreateDatasetModal({
  embeddingModels,
  llmModels,
  onClose,
  onSuccess,
}: {
  embeddingModels: ModelOption[];
  llmModels: ModelOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [embeddingModelId, setEmbeddingModelId] = useState(embeddingModels[0]?.id || "");
  const [llmModelId, setLlmModelId] = useState(llmModels[0]?.id || "");
  const [chunkSize, setChunkSize] = useState(512);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!embeddingModelId && embeddingModels[0]?.id) {
      setEmbeddingModelId(embeddingModels[0].id);
    }
  }, [embeddingModelId, embeddingModels]);

  useEffect(() => {
    if (!llmModelId && llmModels[0]?.id) {
      setLlmModelId(llmModels[0].id);
    }
  }, [llmModelId, llmModels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!embeddingModelId) {
      setError("请先选择嵌入模型");
      return;
    }
    if (!llmModelId) {
      setError("请先选择语言模型");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/knowledge/dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          intro,
          embeddingModelId,
          llmModelId,
          chunkSize,
          type: "dataset",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "创建知识库失败");
      }
      onSuccess();
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "创建知识库失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900">创建知识库</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
          <div>
            <label className="block text-sm font-medium text-gray-700">名称 <span className="text-red-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="请输入知识库名称" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">简介</label>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="请输入简介" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">嵌入模型</label>
              <select value={embeddingModelId} onChange={(e) => setEmbeddingModelId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {embeddingModels.length === 0 ? <option value="">暂无可用嵌入模型</option> : null}
                {embeddingModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.embeddingDimension || "-"} 维)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">语言模型</label>
              <select value={llmModelId} onChange={(e) => setLlmModelId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {llmModels.length === 0 ? <option value="">暂无可用语言模型</option> : null}
                {llmModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.model})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            嵌入模型在知识库创建后不可修改，如需更换请重新创建新的知识库。
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">分块大小</label>
            <input type="number" value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">取消</button>
            <button type="submit" disabled={loading || !name.trim() || !embeddingModelId || !llmModelId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "创建中..." : "创建"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
