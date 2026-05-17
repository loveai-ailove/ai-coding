"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { TreeSelect } from "@/components/ui/TreeSelect";
import { buildTree, collectParentNodeIds } from "@/lib/system/tree";

type MenuRecord = {
  id: number;
  parentId: number | null;
  parentName: string | null;
  name: string;
  type: "DIRECTORY" | "MENU" | "BUTTON";
  path: string | null;
  component: string | null;
  perms: string | null;
  icon: string | null;
  orderNum: number;
  visible: boolean;
  status: "ACTIVE" | "DISABLED";
  remark: string | null;
  level: number;
};

type MenuFormState = {
  parentId: string;
  name: string;
  type: "DIRECTORY" | "MENU" | "BUTTON";
  path: string;
  component: string;
  perms: string;
  icon: string;
  orderNum: number;
  visible: boolean;
  status: "ACTIVE" | "DISABLED";
  remark: string;
};

const emptyForm: MenuFormState = {
  parentId: "",
  name: "",
  type: "MENU" as const,
  path: "",
  component: "",
  perms: "",
  icon: "",
  orderNum: 0,
  visible: true,
  status: "ACTIVE" as const,
  remark: "",
};

export function MenuManager({
  menus,
  permissions,
}: {
  menus: MenuRecord[];
  permissions: { create: boolean; update: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<MenuFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const menuTree = useMemo(() => buildTree(menus), [menus]);

  useEffect(() => {
    setExpandedIds(collectParentNodeIds(menuTree));
  }, [menuTree]);

  const flattenTree = useMemo(() => {
    const result: MenuRecord[] = [];
    const walk = (nodes: typeof menuTree, depth: number) => {
      for (const node of nodes) {
        result.push({ ...node, level: depth, children: undefined } as unknown as MenuRecord);
        if (expandedIds.has(node.id) && node.children.length > 0) {
          walk(node.children, depth + 1);
        }
      }
    };
    walk(menuTree, 0);
    return result;
  }, [menuTree, expandedIds]);

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
    setExpandedIds(collectParentNodeIds(menuTree));
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

  function startEdit(menu: MenuRecord) {
    setEditingId(menu.id);
    setError("");
    setForm({
      parentId: menu.parentId ? String(menu.parentId) : "",
      name: menu.name,
      type: menu.type,
      path: menu.path ?? "",
      component: menu.component ?? "",
      perms: menu.perms ?? "",
      icon: menu.icon ?? "",
      orderNum: menu.orderNum,
      visible: menu.visible,
      status: menu.status,
      remark: menu.remark ?? "",
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
        type: form.type,
        path: form.path || null,
        component: form.component || null,
        perms: form.perms || null,
        icon: form.icon || null,
        orderNum: form.orderNum,
        visible: form.visible,
        status: form.status,
        remark: form.remark || null,
      };

      const response = await fetch(
        editingId ? `/api/admin/system/menus/${editingId}` : "/api/admin/system/menus",
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
    if (!confirm("确定删除这个菜单吗？")) return;

    const response = await fetch(`/api/admin/system/menus/${id}`, { method: "DELETE" });
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
          <h1 className="text-2xl font-bold text-gray-900">菜单管理</h1>
          <p className="mt-1 text-sm text-gray-500">目录、菜单和按钮权限统一从这里维护。</p>
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
              新增菜单
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">菜单名称</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">类型</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">路由</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">权限标识</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">状态</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {flattenTree.map((menu) => {
              const hasChildren = menuTree.some(
                (node) => node.id === menu.id && node.children.length > 0
              ) || menus.some((m) => m.parentId === menu.id);

              return (
                <tr key={menu.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center" style={{ paddingLeft: `${menu.level * 24}px` }}>
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(menu.id)}
                          className="mr-2 flex h-5 w-5 items-center justify-center rounded hover:bg-gray-200"
                        >
                          <svg
                            className={`h-3 w-3 text-gray-500 transition-transform ${expandedIds.has(menu.id) ? "rotate-90" : ""}`}
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
                      {menu.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      menu.type === "DIRECTORY" ? "bg-blue-50 text-blue-700" :
                      menu.type === "MENU" ? "bg-green-50 text-green-700" :
                      "bg-orange-50 text-orange-700"
                    }`}>
                      {menu.type === "DIRECTORY" ? "目录" : menu.type === "MENU" ? "菜单" : "按钮"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{menu.path || "-"}</td>
                  <td className="px-4 py-3 text-gray-500">{menu.perms || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      menu.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {menu.status === "ACTIVE" ? "启用" : "禁用"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      {permissions.update ? (
                        <button type="button" onClick={() => startEdit(menu)} className="text-blue-600 hover:text-blue-800">
                          编辑
                        </button>
                      ) : null}
                      {permissions.delete ? (
                        <button type="button" onClick={() => handleDelete(menu.id)} className="text-red-600 hover:text-red-800">
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
        title={editingId ? `编辑菜单 #${editingId}` : "新增菜单"}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmit}>
          {error ? <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm text-gray-700">
              上级菜单
              <TreeSelect
                value={form.parentId}
                onChange={(val) => setForm({ ...form, parentId: val })}
                options={menuTree}
                placeholder="顶级菜单"
                excludeId={editingId}
              />
            </label>
            <label className="block text-sm text-gray-700">
              菜单名称
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              菜单类型
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as "DIRECTORY" | "MENU" | "BUTTON" })}
              >
                <option value="DIRECTORY">目录</option>
                <option value="MENU">菜单</option>
                <option value="BUTTON">按钮</option>
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              路由路径
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.path}
                onChange={(event) => setForm({ ...form, path: event.target.value })}
                placeholder="/admin/system/users"
              />
            </label>
            <label className="block text-sm text-gray-700">
              组件标识
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.component}
                onChange={(event) => setForm({ ...form, component: event.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              权限标识
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.perms}
                onChange={(event) => setForm({ ...form, perms: event.target.value })}
                placeholder="system:user:list"
              />
            </label>
            <label className="block text-sm text-gray-700">
              图标
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.icon}
                onChange={(event) => setForm({ ...form, icon: event.target.value })}
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

          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.visible}
              onChange={(event) => setForm({ ...form, visible: event.target.checked })}
            />
            侧边栏可见
          </label>

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
              {loading ? "保存中..." : editingId ? "更新菜单" : "创建菜单"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
