"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AiModelRecord = {
  id: number;
  type: "LLM" | "EMBEDDING";
  name: string;
  code: string;
  provider: string;
  protocol: string;
  model: string;
  baseUrl: string;
  isActive: boolean;
  isDefault: boolean;
  sort: number;
  maxContext: number | null;
  maxResponse: number | null;
  quoteMaxToken: number | null;
  maxTemperature: number | null;
  defaultSystemPrompt: string | null;
  embeddingDimension: number | null;
  embeddingMaxToken: number | null;
  defaultConfig: Record<string, any> | null;
  remark: string | null;
};

type ModelFormState = {
  type: "LLM" | "EMBEDDING";
  name: string;
  code: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  isDefault: boolean;
  sort: number;
  maxContext: string;
  maxResponse: string;
  quoteMaxToken: string;
  maxTemperature: string;
  defaultSystemPrompt: string;
  embeddingDimension: string;
  embeddingMaxToken: string;
  defaultConfig: string;
  remark: string;
};

const emptyForm: ModelFormState = {
  type: "LLM",
  name: "",
  code: "",
  provider: "",
  model: "",
  baseUrl: "",
  apiKey: "",
  isActive: true,
  isDefault: false,
  sort: 0,
  maxContext: "",
  maxResponse: "",
  quoteMaxToken: "",
  maxTemperature: "",
  defaultSystemPrompt: "",
  embeddingDimension: "",
  embeddingMaxToken: "",
  defaultConfig: "",
  remark: ""
};

export function AiModelManager({
  initialModels,
  permissions
}: {
  initialModels: AiModelRecord[];
  permissions: { create: boolean; update: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [models, setModels] = useState(initialModels);
  const [editing, setEditing] = useState<AiModelRecord | null>(null);
  const [form, setForm] = useState<ModelFormState>(emptyForm);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [filter, setFilter] = useState<"ALL" | "LLM" | "EMBEDDING">("ALL");

  const filteredModels = useMemo(
    () => models.filter((item) => filter === "ALL" || item.type === filter),
    [filter, models]
  );
  const formFingerprint = useMemo(
    () => JSON.stringify({ editingId: editing?.id ?? null, ...form }),
    [editing?.id, form]
  );

  useEffect(() => {
    setTestResult(null);
  }, [formFingerprint]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setTestResult(null);
    setOpen(true);
  }

  function openEdit(model: AiModelRecord) {
    setEditing(model);
    setForm({
      type: model.type,
      name: model.name,
      code: model.code,
      provider: model.provider,
      model: model.model,
      baseUrl: model.baseUrl,
      apiKey: "",
      isActive: model.isActive,
      isDefault: model.isDefault,
      sort: model.sort,
      maxContext: model.maxContext ? String(model.maxContext) : "",
      maxResponse: model.maxResponse ? String(model.maxResponse) : "",
      quoteMaxToken: model.quoteMaxToken ? String(model.quoteMaxToken) : "",
      maxTemperature: model.maxTemperature ? String(model.maxTemperature) : "",
      defaultSystemPrompt: model.defaultSystemPrompt || "",
      embeddingDimension: model.embeddingDimension ? String(model.embeddingDimension) : "",
      embeddingMaxToken: model.embeddingMaxToken ? String(model.embeddingMaxToken) : "",
      defaultConfig: model.defaultConfig ? JSON.stringify(model.defaultConfig, null, 2) : "",
      remark: model.remark || ""
    });
    setError("");
    setTestResult(null);
    setOpen(true);
  }

  async function refresh() {
    const res = await fetch("/api/admin/ai-models");
    const data = await res.json();
    if (res.ok) {
      setModels(data.list || []);
      router.refresh();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        apiKey: form.apiKey || (editing ? "__KEEP_EXISTING__" : "")
      };

      const endpoint = editing ? `/api/admin/ai-models/${editing.id}` : "/api/admin/ai-models";
      const res = await fetch(endpoint, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存失败");
      }
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setError("");
    setTestResult(null);

    try {
      const payload = {
        id: editing?.id,
        ...form,
        apiKey: form.apiKey || (editing ? "__KEEP_EXISTING__" : "")
      };

      const res = await fetch("/api/admin/ai-models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "连通性测试失败");
      }

      const message = [data.message, data.details].filter(Boolean).join("，");
      setTestResult({ type: "success", message: message || "连通性测试通过" });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "连通性测试失败";
      setTestResult({ type: "error", message });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除这个模型吗？")) return;
    const res = await fetch(`/api/admin/ai-models/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "删除失败");
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 模型管理</h1>
          <p className="mt-1 text-sm text-gray-500">一期仅支持 OpenAI 兼容协议，供知识库和工作流统一选择。</p>
        </div>
        {permissions.create ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            新增模型
          </button>
        ) : null}
      </div>

      <div className="flex gap-2">
        {(["ALL", "LLM", "EMBEDDING"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-lg px-3 py-2 text-sm ${
              filter === item ? "bg-blue-50 text-blue-600" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {item === "ALL" ? "全部" : item === "LLM" ? "语言模型" : "嵌入模型"}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">名称</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">类型</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">模型编码</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">提供商</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">默认信息</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">状态</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredModels.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">{item.model}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{item.type === "LLM" ? "语言模型" : "嵌入模型"}</td>
                <td className="px-4 py-3 text-gray-600">{item.code}</td>
                <td className="px-4 py-3 text-gray-600">{item.provider}</td>
                <td className="px-4 py-3 text-gray-600">
                  {item.type === "LLM"
                    ? `上下文 ${item.maxContext || "-"} / 回复 ${item.maxResponse || "-"}`
                    : `维度 ${item.embeddingDimension || "-"} / MaxToken ${item.embeddingMaxToken || "-"}`}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs ${item.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {item.isActive ? "启用" : "停用"}
                    </span>
                    {item.isDefault ? (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">默认</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {permissions.update ? (
                      <button type="button" onClick={() => openEdit(item)} className="text-blue-600 hover:underline">
                        编辑
                      </button>
                    ) : null}
                    {permissions.delete ? (
                      <button type="button" onClick={() => handleDelete(item.id)} className="text-red-500 hover:underline">
                        删除
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {filteredModels.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  暂无模型
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">{editing ? "编辑模型" : "新增模型"}</h2>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
              {testResult ? (
                <div
                  className={`rounded-lg px-4 py-3 text-sm ${
                    testResult.type === "success"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {testResult.message}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-gray-700">模型类型</div>
                  <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as "LLM" | "EMBEDDING" }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="LLM">语言模型</option>
                    <option value="EMBEDDING">嵌入模型</option>
                  </select>
                </label>
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-gray-700">展示名称</div>
                  <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-gray-700">模型编码</div>
                  <input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-gray-700">提供商</div>
                  <input value={form.provider} onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-gray-700">请求模型名</div>
                  <input value={form.model} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-gray-700">Base URL</div>
                  <input value={form.baseUrl} onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block">
                <div className="mb-1 text-sm font-medium text-gray-700">API Key {editing ? <span className="text-gray-400">(留空则保持不变)</span> : null}</div>
                <input type="password" value={form.apiKey} onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </label>

              {form.type === "LLM" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-sm font-medium text-gray-700">最大上下文</div>
                    <input value={form.maxContext} onChange={(e) => setForm((prev) => ({ ...prev, maxContext: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm font-medium text-gray-700">最大回复</div>
                    <input value={form.maxResponse} onChange={(e) => setForm((prev) => ({ ...prev, maxResponse: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm font-medium text-gray-700">最大引用 Token</div>
                    <input value={form.quoteMaxToken} onChange={(e) => setForm((prev) => ({ ...prev, quoteMaxToken: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm font-medium text-gray-700">最大温度</div>
                    <input value={form.maxTemperature} onChange={(e) => setForm((prev) => ({ ...prev, maxTemperature: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-sm font-medium text-gray-700">向量维度</div>
                    <input value={form.embeddingDimension} onChange={(e) => setForm((prev) => ({ ...prev, embeddingDimension: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-sm font-medium text-gray-700">最大 Token</div>
                    <input value={form.embeddingMaxToken} onChange={(e) => setForm((prev) => ({ ...prev, embeddingMaxToken: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                </div>
              )}

              {form.type === "LLM" ? (
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-gray-700">默认系统提示词</div>
                  <textarea value={form.defaultSystemPrompt} onChange={(e) => setForm((prev) => ({ ...prev, defaultSystemPrompt: e.target.value }))} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
              ) : null}

              <label className="block">
                <div className="mb-1 text-sm font-medium text-gray-700">默认配置 JSON</div>
                <textarea value={form.defaultConfig} onChange={(e) => setForm((prev) => ({ ...prev, defaultConfig: e.target.value }))} rows={5} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm" placeholder='{"top_p":0.8}' />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-gray-700">排序</div>
                  <input type="number" value={form.sort} onChange={(e) => setForm((prev) => ({ ...prev, sort: Number(e.target.value) }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm font-medium text-gray-700">备注</div>
                  <input value={form.remark} onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                  启用
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))} />
                  设为默认
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={saving || testing}
                  className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  {testing ? "测试中..." : "保存前连通性测试"}
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
