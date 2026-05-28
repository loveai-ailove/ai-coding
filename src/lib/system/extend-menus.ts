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

export async function extendMenus(): Promise<MenuSeedResult> {
  return prisma.$transaction(async (tx) => {
    const createdMenuIds: number[] = [];

    const knowledgeRootResult = await ensureMenu(tx, {
      parentId: null,
      type: MenuType.DIRECTORY,
      name: "知识库管理",
      data: {
        parentId: null,
        name: "知识库管理",
        type: MenuType.DIRECTORY,
        path: "/admin/knowledge",
        component: "admin/knowledge",
        icon: "book-open",
        orderNum: 3,
        status: Status.ACTIVE,
      },
    });
    if (knowledgeRootResult.created) {
      createdMenuIds.push(knowledgeRootResult.menu.id);
    }

    const knowledgeListResult = await ensureMenu(tx, {
      parentId: knowledgeRootResult.menu.id,
      type: MenuType.MENU,
      name: "知识库列表",
      data: {
        parentId: knowledgeRootResult.menu.id,
        name: "知识库列表",
        type: MenuType.MENU,
        path: "/admin/knowledge",
        component: "admin/knowledge/page",
        perms: "knowledge:read",
        orderNum: 1,
        status: Status.ACTIVE,
      },
    });
    if (knowledgeListResult.created) {
      createdMenuIds.push(knowledgeListResult.menu.id);
    }

    const workflowRootResult = await ensureMenu(tx, {
      parentId: null,
      type: MenuType.DIRECTORY,
      name: "工作流管理",
      data: {
        parentId: null,
        name: "工作流管理",
        type: MenuType.DIRECTORY,
        path: "/admin/workflow",
        component: "admin/workflow",
        icon: "git-branch",
        orderNum: 4,
        status: Status.ACTIVE,
      },
    });
    if (workflowRootResult.created) {
      createdMenuIds.push(workflowRootResult.menu.id);
    }

    const workflowListResult = await ensureMenu(tx, {
      parentId: workflowRootResult.menu.id,
      type: MenuType.MENU,
      name: "工作流列表",
      data: {
        parentId: workflowRootResult.menu.id,
        name: "工作流列表",
        type: MenuType.MENU,
        path: "/admin/workflow",
        component: "admin/workflow/page",
        perms: "workflow:read",
        orderNum: 1,
        status: Status.ACTIVE,
      },
    });
    if (workflowListResult.created) {
      createdMenuIds.push(workflowListResult.menu.id);
    }

    const buttonSeeds = [
      {
        parentId: knowledgeListResult.menu.id,
        name: "知识库新增",
        perms: "knowledge:create",
      },
      {
        parentId: knowledgeListResult.menu.id,
        name: "知识库修改",
        perms: "knowledge:update",
      },
      {
        parentId: knowledgeListResult.menu.id,
        name: "知识库删除",
        perms: "knowledge:delete",
      },
      {
        parentId: workflowListResult.menu.id,
        name: "工作流新增",
        perms: "workflow:create",
      },
      {
        parentId: workflowListResult.menu.id,
        name: "工作流修改",
        perms: "workflow:update",
      },
      {
        parentId: workflowListResult.menu.id,
        name: "工作流删除",
        perms: "workflow:delete",
      },
      {
        parentId: workflowListResult.menu.id,
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
