import { MenuType, Status, type PrismaClient } from "@/generated/prisma/client";

export async function seedKnowledgeAndWorkflowMenus(tx: PrismaClient) {
  const existingAiCenter = await tx.sysMenu.findFirst({ where: { name: "AI中心", type: MenuType.DIRECTORY } });
  if (existingAiCenter) {
    console.log("[seed] Knowledge menus already exist, skipping");
    return;
  }

  const aiCenter = await tx.sysMenu.create({
    data: {
      name: "AI中心",
      type: MenuType.DIRECTORY,
      path: "/admin/ai-center",
      component: "admin/ai-center/page",
      icon: "bot",
      orderNum: 3,
      status: Status.ACTIVE,
    },
  });

  const knowledgeRoot = await tx.sysMenu.create({
    data: {
      parentId: aiCenter.id,
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
      parentId: aiCenter.id,
      name: "工作流管理",
      type: MenuType.MENU,
      path: "/admin/workflow",
      component: "admin/workflow/page",
      icon: "workflow",
      perms: "workflow:read",
      orderNum: 2,
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
