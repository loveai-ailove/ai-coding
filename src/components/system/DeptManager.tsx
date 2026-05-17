"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { TreeSelect } from "@/components/ui/TreeSelect";
import { buildTree, collectParentNodeIds } from "@/lib/system/tree";

type DeptRecord = {
  id: number;
  parentId: number | null;
  parentName: string | null;
  name: string;
  level: number;
  orderNum: number;
  leader: string | null;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "DISABLED";
  remark: string | null;
};

type DeptFormState = {
  parentId: string;
  name: string;
  orderNum: number;
  leader: string;
  phone: string;
  email: string;
  status: "ACTIVE" | "DISABLED";
  remark: string;
};

const emptyForm: DeptFormState = {
  parentId: "",
  name: "",
  orderNum: 0,
  leader: "",
  phone: "",
  email: "",
  status: "ACTIVE" as const,
  remark: "",
};

export function DeptManager({
  depts,
  permissions,
}: {
  depts: DeptRecord[];
  permissions: { create: boolean; update: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<DeptFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const deptTree = useMemo(() => buildTree(depts), [depts]);

  useEffect(() => {
    setExpandedIds(collectParentNodeIds(deptTree));
  }, [deptTree]);

  const flattenTree = useMemo(() => {
    const result: DeptRecord[] = [];
    const walk = (nodes: typeof deptTree, depth: number) => {
      for (const node of nodes) {
        result.push({ ...node, level: depth, children: undefined } as unknown as DeptRecord);
        if (expandedIds.has(node.id) && node.children.length > 0) {
          walk(node.children, depth + 1);
        }
      }
    };
    walk(deptTree, 0);
    return result;
  }, [deptTree, expandedIds]);

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(collectParentNodeIds(deptTree));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function resetForm() {
    setEditingId(null);
    setIsModalOpen(false);
    setForm(emptyForm);
    setError("");
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setIsModalOpen(true);
  }

  function startEdit(dept: DeptRecord) {
    setEditingId(dept.id);
    setError("");
    setForm({
      parentId: dept.parentId ? String(dept.parentId) : "",
      name: dept.name,
      orderNum: dept.orderNum,
      leader: dept.leader ?? "",
      phone: dept.phone ?? "",
      email: dept.email ?? "",
      status: dept.status,
      remark: dept.remark ?? "",
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        parentId: form.parentId ? Number(form.parentId) : null,
        name: form.name,
        orderNum: form.orderNum,
        leader: form.leader || null,
        phone: form.phone || null,
        email: form.email || null,
        status: form.status,
        remark: form.remark || null,
      };

      const response = await fetch(
        editingId ? `/api/admin/system/depts/${editingId}` : "/api/admin/system/depts",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "保存失败");
      }

      resetForm();
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除这个部门吗？")) return;

    const response = await fetch(`/api/admin/system/depts/${id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "删除失败");
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">部门管理</h1>
          <p className="mt-1 text-sm text-gray-500">维护后台组织架构树和负责人信息。</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            展开全部
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            收起全部
          </button>
          {permissions.create ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              新增部门
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">部门名称</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">负责人</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">联系电话</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">状态</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">排序</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {flattenTree.map((dept) => {
              const hasChildren = deptTree.some(
                (node) => node.id === dept.id && node.children.length > 0
              ) || depts.some((d) => d.parentId === dept.id);

              return (
                <tr key={dept.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center" style={{ paddingLeft: `${dept.level * 24}px` }}>
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(dept.id)}
                          className="mr-2 flex h-5 w-5 items-center justify-center rounded hover:bg-gray-200"
                        >
                          <svg
                            className={`h-3 w-3 text-gray-500 transition-transform ${expandedIds.has(dept.id) ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <span className="mr-2 w-5" />
                      )}
                      {dept.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">{dept.leader || "-"}</td>
                  <td className="px-4 py-3 text-gray-500">{dept.phone || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      dept.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {dept.status === "ACTIVE" ? "启用" : "禁用"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{dept.orderNum}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      {permissions.update ? (
                        <button type="button" onClick={() => startEdit(dept)} className="text-blue-600 hover:text-blue-800">
                          编辑
                        </button>
                      ) : null}
                      {permissions.delete ? (
                        <button type="button" onClick={() => handleDelete(dept.id)} className="text-red-600 hover:text-red-800">
                          删除
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={isModalOpen}
        onClose={resetForm}
        title={editingId ? `编辑部门 #${editingId}` : "新增部门"}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmit}>
          {error ? <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm text-gray-700">
              上级部门
              <TreeSelect
                value={form.parentId}
                onChange={(val) => setForm({ ...form, parentId: val })}
                options={deptTree}
                placeholder="顶级部门"
                excludeId={editingId}
              />
            </label>
            <label className="block text-sm text-gray-700">
              部门名称
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              排序
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.orderNum}
                onChange={(event) => setForm({ ...form, orderNum: Number(event.target.value) })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              负责人
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.leader}
                onChange={(event) => setForm({ ...form, leader: event.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              联系电话
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              邮箱
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              状态
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as "ACTIVE" | "DISABLED" })}
              >
                <option value="ACTIVE">启用</option>
                <option value="DISABLED">禁用</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm text-gray-700">
            备注
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              rows={3}
              value={form.remark}
              onChange={(event) => setForm({ ...form, remark: event.target.value })}
            />
          </label>

          <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "保存中..." : editingId ? "更新部门" : "创建部门"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
