import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/permission";
import { DeptManager } from "@/components/system/DeptManager";
import { getLevelFromAncestors } from "@/lib/system/tree";

export default async function SystemDeptsPage() {
  const user = await requirePermission("system:dept:list");
  const depts = await prisma.sysDept.findMany({
    orderBy: [{ ancestors: "asc" }, { orderNum: "asc" }, { id: "asc" }],
  });
  const deptMap = new Map(depts.map((item) => [item.id, item.name]));

  return (
    <DeptManager
      depts={depts.map((item) => ({
        id: item.id,
        parentId: item.parentId,
        parentName: item.parentId ? deptMap.get(item.parentId) || null : null,
        name: item.name,
        level: getLevelFromAncestors(item.ancestors),
        orderNum: item.orderNum,
        leader: item.leader,
        phone: item.phone,
        email: item.email,
        status: item.status,
        remark: item.remark,
      }))}
      permissions={{
        create: hasPermission(user, "system:dept:create"),
        update: hasPermission(user, "system:dept:update"),
        delete: hasPermission(user, "system:dept:delete"),
      }}
    />
  );
}
