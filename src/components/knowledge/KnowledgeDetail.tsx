"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Collection {
  id: string;
  name: string;
  type: string;
  tags: string[];
  rawTextLength?: number;
  createTime: string;
  dataCount?: number;
}

interface DatasetDetail {
  id: string;
  name: string;
  intro: string;
  vectorModel: string;
  agentModel: string;
  chunkSize: number;
}

interface CollectionChunk {
  id: string;
  q: string;
  a?: string;
  chunkIndex: number;
}

export function KnowledgeDetail({ datasetId }: { datasetId: string }) {
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dsRes, colRes] = await Promise.all([
        fetch(`/api/knowledge/dataset/${datasetId}`),
        fetch(`/api/knowledge/dataset/${datasetId}/collections?pageSize=100`),
      ]);
      const dsData = await dsRes.json();
      const colData = await colRes.json();

      if (!dsRes.ok) {
        throw new Error(dsData.error || "获取知识库详情失败");
      }
      if (!colRes.ok) {
        throw new Error(colData.error || "获取集合列表失败");
      }

      setDataset(dsData);
      setCollections(Array.isArray(colData?.list) ? colData.list : []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "获取知识库详情失败");
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteCollection = async (id: string, name: string) => {
    if (!confirm(`确定删除集合"${name}"及其所有数据吗？`)) return;
    const res = await fetch(`/api/knowledge/dataset/${datasetId}/collections/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  if (loading) return <div className="py-20 text-center text-gray-400">加载中...</div>;
  if (!dataset) return <div className="py-20 text-center text-gray-400">{error || "知识库不存在"}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/knowledge" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{dataset.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{dataset.intro || "暂无简介"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSearch(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">搜索测试</button>
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ 添加数据</button>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-gray-500">
        <span>向量模型: {dataset.vectorModel}</span>
        <span>AI模型: {dataset.agentModel}</span>
        <span>分块大小: {dataset.chunkSize}</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">数据集合 ({collections.length})</h2>
        </div>
        {error ? <div className="border-b border-gray-100 px-6 py-3 text-sm text-red-600">{error}</div> : null}
        {collections.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p>暂无数据</p>
            <button onClick={() => setShowCreate(true)} className="mt-2 text-sm text-blue-600 hover:underline">添加第一条数据</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {collections.map((col) => (
              <div key={col.id} onClick={() => setActiveCollection(col)} className="flex cursor-pointer items-center justify-between px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-xs font-medium text-blue-600">
                    {col.type === "text" ? "TXT" : col.type === "link" ? "URL" : "DOC"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{col.name}</p>
                    <p className="text-xs text-gray-400">{col.dataCount ?? 0} 条数据 · {new Date(col.createTime).toLocaleDateString()}</p>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col.id, col.name); }} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500" title="删除">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateCollectionModal datasetId={datasetId} chunkSize={dataset.chunkSize} onClose={() => setShowCreate(false)} onSuccess={fetchData} />}
      {showSearch && <SearchTestPanel datasetId={datasetId} onClose={() => setShowSearch(false)} />}
      {activeCollection && <CollectionChunksModal datasetId={datasetId} collection={activeCollection} onClose={() => setActiveCollection(null)} />}
    </div>
  );
}

function CreateCollectionModal({ datasetId, chunkSize, onClose, onSuccess }: { datasetId: string; chunkSize: number; onClose: () => void; onSuccess: () => void }) {
  const [tab, setTab] = useState<"text" | "link">("text");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const body = tab === "text"
        ? { name: name || "文本数据", type: "text", rawText: content, chunkSize }
        : { name: name || link, type: "link", rawLink: link, chunkSize };
      const res = await fetch(`/api/knowledge/dataset/${datasetId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "创建集合失败");
      }
      onSuccess();
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "创建集合失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900">添加数据</h2>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setTab("text")} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "text" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>文本数据</button>
          <button onClick={() => setTab("link")} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "link" ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"}`}>网页链接</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
          <div>
            <label className="block text-sm font-medium text-gray-700">名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={tab === "text" ? "文本数据" : "网页地址"} />
          </div>
          {tab === "text" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">内容 <span className="text-red-500">*</span></label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" placeholder="请输入文本内容..." />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700">网页链接 <span className="text-red-500">*</span></label>
              <input value={link} onChange={(e) => setLink(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://example.com/article" />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">取消</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "处理中..." : "确认添加"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CollectionChunksModal({ datasetId, collection, onClose }: { datasetId: string; collection: Collection; onClose: () => void }) {
  const [chunks, setChunks] = useState<CollectionChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/knowledge/dataset/${datasetId}/data?collectionId=${collection.id}&pageSize=200`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "获取分块详情失败");
        setChunks(Array.isArray(data?.list) ? data.list : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "获取分块详情失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [datasetId, collection.id]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}><div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}><div className="border-b px-6 py-4"><h2 className="text-lg font-semibold text-gray-900">{collection.name}</h2><p className="mt-1 text-sm text-gray-500">共 {chunks.length} 个分块</p></div><div className="flex-1 overflow-y-auto p-6">{error ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}{loading ? <div className="py-16 text-center text-gray-400">加载中...</div> : chunks.length === 0 ? <div className="py-16 text-center text-gray-400">该集合暂无分块数据</div> : <div className="space-y-3">{chunks.map((item) => <div key={item.id} className="rounded-lg border border-gray-200 p-4"><div className="text-xs text-gray-400">Chunk #{item.chunkIndex + 1}</div><p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{item.q}</p>{item.a ? <p className="mt-2 text-sm text-gray-500">{item.a}</p> : null}</div>)}</div>}</div></div></div>;
}

function SearchTestPanel({ datasetId, onClose }: { datasetId: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [similarity, setSimilarity] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/knowledge/dataset/${datasetId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, datasetIds: [datasetId], similarity }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "搜索失败");
      }
      setResults(Array.isArray(data?.list) ? data.list : []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "搜索失败");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">搜索测试</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex gap-3 border-b px-6 py-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="输入搜索内容..." />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>相似度:</span>
            <input type="number" value={similarity} onChange={(e) => setSimilarity(Number(e.target.value))} min={0} max={1} step={0.05} className="w-20 rounded border border-gray-300 px-2 py-1 text-sm" />
          </div>
          <button onClick={handleSearch} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "搜索中..." : "搜索"}</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {error ? <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
          {results.length === 0 ? (
            <div className="py-16 text-center text-gray-400">{loading ? "搜索中..." : "输入内容开始搜索"}</div>
          ) : (
            <div className="space-y-4">
              {results.map((r, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">相似度: {(r.score * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-900 font-medium">{r.q}</p>
                  {r.a && <p className="mt-1 text-sm text-gray-500">{r.a}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
