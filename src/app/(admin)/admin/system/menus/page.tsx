import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/permission";
import { MenuManager } from "@/components/system/MenuManager";
import { buildLevelMap } from "@/lib/system/tree";

export default async function SystemMenusPage() {
  const user = await requirePermission("system:menu:list");
  const menus = await prisma.sysMenu.findMany({ orderBy: [{ orderNum: "asc" }, { id: "asc" }] });
  const menuMap = new Map(menus.map((item) => [item.id, item.name]));
  const levelMap = buildLevelMap(menus.map((item) => ({ id: item.id, parentId: item.parentId })));

  return (
    <MenuManager
      menus={menus.map((item) => ({
        id: item.id,
        parentId: item.parentId,
        parentName: item.parentId ? menuMap.get(item.parentId) || null : null,
        name: item.name,
        type: item.type,
        path: item.path,
        component: item.component,
        perms: item.perms,
        icon: item.icon,
        orderNum: item.orderNum,
        visible: item.visible,
        status: item.status,
        remark: item.remark,
        level: levelMap.get(item.id) || 0,
      }))}
      permissions={{
        create: hasPermission(user, "system:menu:create"),
        update: hasPermission(user, "system:menu:update"),
        delete: hasPermission(user, "system:menu:delete"),
      }}
    />
  );
}
