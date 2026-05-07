"use client";

import { useRouter } from "next/navigation";

export function DeleteButton({ id }: { id: number }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("确定要删除该用户吗？")) return;

    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });

    if (res.ok) {
      router.refresh();
    } else {
      alert("删除失败");
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="text-red-600 hover:text-red-800"
    >
      删除
    </button>
  );
}
