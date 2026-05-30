import { Prisma, MenuType, Status } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type MenuSeedResult = {
  created: boolean;
  createdMenuIds: number[];
};

async function ensureMenu(
  tx: Prisma.TransactionClient,
  params: {
    parentId: number | null;
    type: MenuType;
    name: string;
    data: {
      parentId?: number | null;
      name: string;
      type: MenuType;
      path?: string | null;
      component?: string | null;
      perms?: string | null;
      icon?: string | null;
      orderNum?: number;
      visible?: boolean;
      status?: Status;
      remark?: string | null;
    };
  }
) {
  const existing = await tx.sysMenu.findFirst({
    where: {
      parentId: params.parentId,
      type: params.type,
      name: params.name,
    },
  });

  if (existing) {
    return {
      menu: existing,
      created: false,
    };
  }

  const created = await tx.sysMenu.create({
    data: params.data,
  });

  return {
    menu: created,
    created: true,
  };
}

async function ensureMenuByPath(
  tx: Prisma.TransactionClient,
  params: {
    lookup: {
      path?: string | null;
      type: MenuType;
      name: string;
    };
    data: {
      parentId?: number | null;
      name: string;
      type: MenuType;
      path?: string | null;
      component?: string | null;
      perms?: string | null;
      icon?: string | null;
      orderNum?: number;
      visible?: boolean;
      status?: Status;
      remark?: string | null;
    };
  }
) {
  const existing = await tx.sysMenu.findFirst({
    where: params.lookup.path
      ? {
          OR: [
            { path: params.lookup.path, type: params.lookup.type },
            { type: params.lookup.type, name: params.lookup.name },
          ],
        }
      : {
          type: params.lookup.type,
          name: params.lookup.name,
        },
  });

  if (existing) {
    const updated = await tx.sysMenu.update({
      where: { id: existing.id },
      data: params.data,
    });
    return {
      menu: updated,
      created: false,
    };
  }

  const created = await tx.sysMenu.create({
    data: params.data,
  });

  return {
    menu: created,
    created: true,
  };
}

async function deleteMenusByIds(tx: Prisma.TransactionClient, menuIds: number[]) {
  if (menuIds.length === 0) return;

  const allIds = new Set<number>(menuIds);
  let cursor = [...menuIds];

  while (cursor.length > 0) {
    const children = await tx.sysMenu.findMany({
      where: { parentId: { in: cursor } },
      select: { id: true },
    });
    const childIds = children.map((item) => item.id).filter((id) => !allIds.has(id));
    childIds.forEach((id) => allIds.add(id));
    cursor = childIds;
  }

  const ids = [...allIds];
  await tx.sysRoleMenu.deleteMany({
    where: { menuId: { in: ids } },
  });
  await tx.sysMenu.deleteMany({
    where: { id: { in: ids } },
  });
}

export async function extendMenus(): Promise<MenuSeedResult> {
  return prisma.$transaction(async (tx) => {
    const createdMenuIds: number[] = [];

    const aiCenterResult = await ensureMenuByPath(tx, {
      lookup: {
        type: MenuType.DIRECTORY,
        name: "AI中心",
      },
      data: {
        parentId: null,
        name: "AI中心",
        type: MenuType.DIRECTORY,
        path: "/admin/ai-center",
        component: "admin/ai-center/page",
        icon: "bot",
        orderNum: 3,
        status: Status.ACTIVE,
      },
    });
    if (aiCenterResult.created) {
      createdMenuIds.push(aiCenterResult.menu.id);
    }

    const aiModelMenuResult = await ensureMenuByPath(tx, {
      lookup: {
        path: "/admin/ai-models",
        type: MenuType.MENU,
        name: "AI模型管理",
      },
      data: {
        parentId: aiCenterResult.menu.id,
        name: "AI模型管理",
        type: MenuType.MENU,
        path: "/admin/ai-models",
        component: "admin/ai-models/page",
        perms: "model:read",
        orderNum: 3,
        status: Status.ACTIVE,
      },
    });
    if (aiModelMenuResult.created) {
      createdMenuIds.push(aiModelMenuResult.menu.id);
    }

    const knowledgeRootResult = await ensureMenuByPath(tx, {
      lookup: {
        path: "/admin/knowledge",
        type: MenuType.MENU,
        name: "知识库管理",
      },
      data: {
        parentId: aiCenterResult.menu.id,
        name: "知识库管理",
        type: MenuType.MENU,
        path: "/admin/knowledge",
        component: "admin/knowledge/page",
        icon: "book-open",
        perms: "knowledge:read",
        orderNum: 1,
        status: Status.ACTIVE,
      },
    });
    if (knowledgeRootResult.created) {
      createdMenuIds.push(knowledgeRootResult.menu.id);
    }

    const workflowRootResult = await ensureMenuByPath(tx, {
      lookup: {
        path: "/admin/workflow",
        type: MenuType.MENU,
        name: "工作流管理",
      },
      data: {
        parentId: aiCenterResult.menu.id,
        name: "工作流管理",
        type: MenuType.MENU,
        path: "/admin/workflow",
        component: "admin/workflow/page",
        icon: "git-branch",
        perms: "workflow:read",
        orderNum: 2,
        status: Status.ACTIVE,
      },
    });
    if (workflowRootResult.created) {
      createdMenuIds.push(workflowRootResult.menu.id);
    }

    const legacyMenus = await tx.sysMenu.findMany({
      where: {
        OR: [
          { name: "知识库列表" },
          { name: "工作流列表" },
          {
            name: "知识库管理",
            type: MenuType.DIRECTORY,
            path: "/admin/knowledge",
          },
          {
            name: "工作流管理",
            type: MenuType.DIRECTORY,
            path: "/admin/workflow",
          },
        ],
      },
      select: { id: true },
    });
    const keepIds = new Set([knowledgeRootResult.menu.id, workflowRootResult.menu.id]);
    const legacyIds = legacyMenus
      .map((item) => item.id)
      .filter((id) => !keepIds.has(id));

    await deleteMenusByIds(tx, legacyIds);

    const buttonSeeds = [
      {
        parentId: aiModelMenuResult.menu.id,
        name: "模型新增",
        perms: "model:create",
      },
      {
        parentId: aiModelMenuResult.menu.id,
        name: "模型修改",
        perms: "model:update",
      },
      {
        parentId: aiModelMenuResult.menu.id,
        name: "模型删除",
        perms: "model:delete",
      },
      {
        parentId: knowledgeRootResult.menu.id,
        name: "知识库新增",
        perms: "knowledge:create",
      },
      {
        parentId: knowledgeRootResult.menu.id,
        name: "知识库修改",
        perms: "knowledge:update",
      },
      {
        parentId: knowledgeRootResult.menu.id,
        name: "知识库删除",
        perms: "knowledge:delete",
      },
      {
        parentId: workflowRootResult.menu.id,
        name: "工作流新增",
        perms: "workflow:create",
      },
      {
        parentId: workflowRootResult.menu.id,
        name: "工作流修改",
        perms: "workflow:update",
      },
      {
        parentId: workflowRootResult.menu.id,
        name: "工作流删除",
        perms: "workflow:delete",
      },
      {
        parentId: workflowRootResult.menu.id,
        name: "工作流调试",
        perms: "workflow:debug",
      },
    ] as const;

    for (const seed of buttonSeeds) {
      const buttonResult = await ensureMenu(tx, {
        parentId: seed.parentId,
        type: MenuType.BUTTON,
        name: seed.name,
        data: {
          parentId: seed.parentId,
          name: seed.name,
          type: MenuType.BUTTON,
          perms: seed.perms,
          orderNum: 99,
          visible: false,
          status: Status.ACTIVE,
        },
      });

      if (buttonResult.created) {
        createdMenuIds.push(buttonResult.menu.id);
      }
    }

    const adminRole = await tx.sysRole.findUnique({
      where: { code: "admin" },
      select: { id: true },
    });

    if (adminRole && createdMenuIds.length > 0) {
      const existingRoleMenus = await tx.sysRoleMenu.findMany({
        where: {
          roleId: adminRole.id,
          menuId: {
            in: createdMenuIds,
          },
        },
        select: { menuId: true },
      });

      const existingMenuIdSet = new Set(existingRoleMenus.map((item) => item.menuId));
      const missingMenuIds = createdMenuIds.filter((menuId) => !existingMenuIdSet.has(menuId));

      if (missingMenuIds.length > 0) {
        await tx.sysRoleMenu.createMany({
          data: missingMenuIds.map((menuId) => ({
            roleId: adminRole.id,
            menuId,
          })),
        });
      }
    }

    return {
      created: createdMenuIds.length > 0,
      createdMenuIds,
    };
  });
}
