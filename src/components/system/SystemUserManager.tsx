"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { TreeSelect } from "@/components/ui/TreeSelect";
import { buildTree } from "@/lib/system/tree";

type UserRecord = {
  id: number;
  username: string;
  nickname: string;
  email: string | null;
  mobile: string | null;
  deptId: number | null;
  deptName: string | null;
  roleIds: number[];
  roleNames: string[];
  status: "ACTIVE" | "DISABLED";
  remark: string | null;
  createdAt: string;
};

type DeptOption = {
  id: number;
  parentId: number | null;
  name: string;
  level: number;
};

type DeptTreeNode = {
  id: number;
  name: string;
  children: DeptTreeNode[];
};

type RoleOption = {
  id: number;
  name: string;
  code: string;
};

type UserFormState = {
  username: string;
  nickname: string;
  password: string;
  email: string;
  mobile: string;
  deptId: string;
  status: "ACTIVE" | "DISABLED";
  roleIds: number[];
  remark: string;
};

const emptyForm: UserFormState = {
  username: "",
  nickname: "",
  password: "",
  email: "",
  mobile: "",
  deptId: "",
  status: "ACTIVE" as const,
  roleIds: [] as number[],
  remark: "",
};

const PAGE_SIZE = 10;

export function SystemUserManager({
  depts,
  roles,
  permissions,
}: {
  depts: DeptOption[];
  roles: RoleOption[];
  permissions: { create: boolean; update: boolean; delete: boolean };
}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listKeyword, setListKeyword] = useState("");
  const [listStatusFilter, setListStatusFilter] = useState<"ALL" | UserRecord["status"]>("ALL");
  const [listDeptFilter, setListDeptFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const formValidationMessage = useMemo(() => {
    if (!form.deptId || form.roleIds.length === 0) {
      return "用户必须分配部门和角色。";
    }
    if (editingId === null && !form.password) {
      return "新增用户时必须填写密码。";
    }
    return "";
  }, [editingId, form.deptId, form.roleIds, form.password]);

  const deptTree = useMemo(() => {
    return buildTree(depts.map(({ id, parentId, name }) => ({ id, parentId, name }))) as unknown as DeptTreeNode[];
  }, [depts]);

  function collectDeptIds(node: DeptTreeNode): number[] {
    const ids = [node.id];
    for (const child of node.children) {
      ids.push(...collectDeptIds(child));
    }
    return ids;
  }

  function findDeptNode(nodes: DeptTreeNode[], id: number): DeptTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findDeptNode(node.children, id);
      if (found) return found;
    }
    return null;
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: PAGE_SIZE.toString(),
      });
      if (listKeyword) params.set("keyword", listKeyword);
      if (listStatusFilter !== "ALL") params.set("status", listStatusFilter);
      if (listDeptFilter) {
        const deptId = Number(listDeptFilter);
        const deptNode = findDeptNode(deptTree, deptId);
        if (deptNode) {
          params.set("deptId", collectDeptIds(deptNode).join(","));
        } else {
          params.set("deptId", String(deptId));
        }
      }

      const res = await fetch(`/api/admin/system/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.list);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("获取用户列表失败:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, listKeyword, listStatusFilter, listDeptFilter, deptTree]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function resetListFilters() {
    setListKeyword("");
    setListStatusFilter("ALL");
    setListDeptFilter("");
    setCurrentPage(1);
  }

  function handlePageChange(page: number) {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
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

  function startEdit(user: UserRecord) {
    setEditingId(user.id);
    setError("");
    setForm({
      username: user.username,
      nickname: user.nickname,
      password: "",
      email: user.email ?? "",
      mobile: user.mobile ?? "",
      deptId: user.deptId ? String(user.deptId) : "",
      status: user.status,
      roleIds: user.roleIds,
      remark: user.remark ?? "",
    });
    setIsModalOpen(true);
  }

  function toggleRole(roleId: number) {
    setForm((current) => ({
      ...current,
      roleIds: current.roleIds.includes(roleId)
        ? current.roleIds.filter((item) => item !== roleId)
        : [...current.roleIds, roleId],
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      if (formValidationMessage) {
        throw new Error(formValidationMessage);
      }

      setLoading(true);

      const payload = {
        username: form.username,
        nickname: form.nickname,
        password: form.password || undefined,
        email: form.email || null,
        mobile: form.mobile || null,
        deptId: form.deptId ? Number(form.deptId) : null,
        status: form.status,
        roleIds: form.roleIds,
        remark: form.remark || null,
      };

      const response = await fetch(
        editingId ? `/api/admin/system/users/${editingId}` : "/api/admin/system/users",
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
    if (!confirm("确定删除这个系统用户吗？")) return;

    const response = await fetch(`/api/admin/system/users/${id}`, { method: "DELETE" });
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

  function getPageNumbers() {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      pages.push(totalPages);
    }

    return pages;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">系统用户管理</h1>
          <p className="mt-1 text-sm text-gray-500">维护后台登录账号、所属部门与角色。</p>
        </div>
        {permissions.create ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            新增用户
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm text-gray-700">
            关键字搜索
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={listKeyword}
              onChange={(event) => {
                setListKeyword(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="用户名 / 昵称 / 邮箱 / 手机号"
            />
          </label>
          <label className="block text-sm text-gray-700">
            按状态筛选
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={listStatusFilter}
              onChange={(event) => {
                setListStatusFilter(event.target.value as "ALL" | UserRecord["status"]);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">全部状态</option>
              <option value="ACTIVE">启用</option>
              <option value="DISABLED">禁用</option>
            </select>
          </label>
          <label className="block text-sm text-gray-700">
            按部门筛选
            <TreeSelect
              value={listDeptFilter}
              onChange={(val) => {
                setListDeptFilter(val);
                setCurrentPage(1);
              }}
              options={deptTree}
              placeholder="全部部门"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-500">总共 {total} 个用户</div>
          <button
            type="button"
            onClick={resetListFilters}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            重置筛选
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">用户名</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">昵称</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">部门</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">角色</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">状态</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">创建时间</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">加载中...</td>
              </tr>
            ) : users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{user.username}</td>
                <td className="px-4 py-3">{user.nickname}</td>
                <td className="px-4 py-3">{user.deptName || "-"}</td>
                <td className="px-4 py-3">{user.roleNames.join("、") || "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {user.status === "ACTIVE" ? "启用" : "禁用"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{user.createdAt}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    {permissions.update ? (
                      <button type="button" onClick={() => startEdit(user)} className="text-blue-600 hover:text-blue-800">
                        编辑
                      </button>
                    ) : null}
                    {permissions.delete ? (
                      <button type="button" onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-800">
                        删除
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && users.length === 0 ? (
        <div className="text-sm text-gray-500">当前筛选条件下暂无用户。</div>
      ) : !loading && totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
          <div className="text-sm text-gray-500">
            共 {total} 条记录，第 {currentPage}/{totalPages} 页
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              上一页
            </button>
            {getPageNumbers().map((page, index) =>
              typeof page === "string" ? (
                <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => handlePageChange(page)}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    currentPage === page
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      ) : null}

      <Modal
        open={isModalOpen}
        onClose={resetForm}
        title={editingId ? `编辑用户 #${editingId}` : "新增用户"}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmit}>
          {error ? <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}
          {formValidationMessage ? (
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">{formValidationMessage}</div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-gray-700">
              用户名
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              昵称
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.nickname}
                onChange={(event) => setForm({ ...form, nickname: event.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              密码{editingId ? "（留空表示不修改）" : ""}
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
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
              手机号
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.mobile}
                onChange={(event) => setForm({ ...form, mobile: event.target.value })}
              />
            </label>
            <label className="block text-sm text-gray-700">
              所属部门
              <TreeSelect
                value={form.deptId}
                onChange={(val) => setForm({ ...form, deptId: val })}
                options={deptTree}
                placeholder="未分配"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
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

          <div className="mt-4">
            <div className="mb-2 text-sm font-medium text-gray-700">关联角色</div>
            <div className="grid gap-2 md:grid-cols-3">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.roleIds.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  <span>{role.name}</span>
                  <span className="text-gray-400">{role.code}</span>
                </label>
              ))}
            </div>
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
              disabled={loading || Boolean(formValidationMessage)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "保存中..." : editingId ? "更新用户" : "创建用户"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
