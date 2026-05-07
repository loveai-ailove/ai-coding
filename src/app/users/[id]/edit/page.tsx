import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/UserForm";
import Link from "next/link";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
  });

  if (!user) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 mb-4">用户不存在</p>
        <Link href="/users" className="text-blue-600 hover:text-blue-800">
          返回用户列表
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">编辑用户</h1>
      <UserForm user={user} />
    </div>
  );
}
