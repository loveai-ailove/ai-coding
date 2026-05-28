import { MenuType, Status, type PrismaClient } from "@/generated/prisma/client";

export async function seedKnowledgeAndWorkflowMenus(tx: PrismaClient) {
  const existingKnowledge = await tx.sysMenu.findFirst({ where: { path: "/admin/knowledge" } });
  if (existingKnowledge) {
    console.log("[seed] Knowledge menus already exist, skipping");
    return;
  }

  const knowledgeRoot = await tx.sysMenu.create({
    data: {
      name: "知识库管理",
      type: MenuType.DIRECTORY,
      path: "/admin/knowledge",
      icon: "book-open",
      orderNum: 3,
      status: Status.ACTIVE,
    },
  });

  await tx.sysMenu.create({
    data: {
      parentId: knowledgeRoot.id,
      name: "知识库列表",
      type: MenuType.MENU,
      path: "/admin/knowledge",
      perms: "knowledge:read",
      orderNum: 1,
      status: Status.ACTIVE,
    },
  });

  await tx.sysMenu.create({
    data: {
      parentId: knowledgeRoot.id,
      name: "创建知识库",
      type: MenuType.BUTTON,
      perms: "knowledge:create",
      orderNum: 2,
      status: Status.ACTIVE,
    },
  });

  await tx.sysMenu.create({
    data: {
      parentId: knowledgeRoot.id,
      name: "编辑知识库",
      type: MenuType.BUTTON,
      perms: "knowledge:update",
      orderNum: 3,
      status: Status.ACTIVE,
    },
  });

  await tx.sysMenu.create({
    data: {
      parentId: knowledgeRoot.id,
      name: "删除知识库",
      type: MenuType.BUTTON,
      perms: "knowledge:delete",
      orderNum: 4,
      status: Status.ACTIVE,
    },
  });

  const workflowRoot = await tx.sysMenu.create({
    data: {
      name: "工作流管理",
      type: MenuType.DIRECTORY,
      path: "/admin/workflow",
      icon: "workflow",
      orderNum: 4,
      status: Status.ACTIVE,
    },
  });

  await tx.sysMenu.create({
    data: {
      parentId: workflowRoot.id,
      name: "工作流列表",
      type: MenuType.MENU,
      path: "/admin/workflow",
      perms: "workflow:read",
      orderNum: 1,
      status: Status.ACTIVE,
    },
  });

  await tx.sysMenu.create({
    data: {
      parentId: workflowRoot.id,
      name: "创建工作流",
      type: MenuType.BUTTON,
      perms: "workflow:create",
      orderNum: 2,
      status: Status.ACTIVE,
    },
  });

  await tx.sysMenu.create({
    data: {
      parentId: workflowRoot.id,
      name: "编辑工作流",
      type: MenuType.BUTTON,
      perms: "workflow:update",
      orderNum: 3,
      status: Status.ACTIVE,
    },
  });

  await tx.sysMenu.create({
    data: {
      parentId: workflowRoot.id,
      name: "删除工作流",
      type: MenuType.BUTTON,
      perms: "workflow:delete",
      orderNum: 4,
      status: Status.ACTIVE,
    },
  });

  await tx.sysMenu.create({
    data: {
      parentId: workflowRoot.id,
      name: "调试工作流",
      type: MenuType.BUTTON,
      perms: "workflow:debug",
      orderNum: 5,
      status: Status.ACTIVE,
    },
  });

  console.log("[seed] Knowledge and workflow menus created successfully");
}
