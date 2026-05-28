"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface App {
  id: string;
  name: string;
  intro: string;
  type: string;
  avatar: string;
  updateTime: string;
}

export function WorkflowList() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workflow/app?type=workflow&pageSize=50");
      if (!res.ok) {
        throw new Error("获取工作流列表失败");
      }
      const data = await res.json();
      setApps(Array.isArray(data?.list) ? data.list : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除工作流"${name}"吗？`)) return;
    const res = await fetch(`/api/workflow/app/${id}`, { method: "DELETE" });
    if (res.ok) fetchApps();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">工作流管理</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + 创建工作流
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">加载中...</div>
      ) : apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-400">暂无工作流</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 text-sm text-blue-600 hover:underline">创建第一个工作流</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link key={app.id} href={`/admin/workflow/${app.id}`} className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" /></svg>
                </div>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(app.id, app.name); }} className="rounded p-1 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500" title="删除">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                </button>
              </div>
              <h3 className="mt-3 text-base font-semibold text-gray-900">{app.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{app.intro || "暂无简介"}</p>
              <div className="mt-3 text-xs text-gray-400">{new Date(app.updateTime).toLocaleDateString()}</div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && <CreateAppModal onClose={() => setShowCreate(false)} onSuccess={fetchApps} />}
    </div>
  );
}

function CreateAppModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workflow/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, intro, type: "workflow" }),
      });
      if (res.ok) {
        const app = await res.json();
        onSuccess();
        window.location.href = `/admin/workflow/${app.id}`;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900">创建工作流</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">名称 <span className="text-red-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="请输入工作流名称" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">简介</label>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="请输入简介" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">取消</button>
            <button type="submit" disabled={loading || !name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "创建中..." : "创建"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
