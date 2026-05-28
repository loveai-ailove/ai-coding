import { getCurrentUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/permission";

export interface KnowledgeUser {
  userId: string;
  username: string;
}

export async function requireKnowledgePermission(permission?: string): Promise<KnowledgeUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (permission) assertPermission(user, permission);
  return { userId: String(user.id), username: user.username };
}

export async function requireWorkflowPermission(permission?: string): Promise<KnowledgeUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (permission) assertPermission(user, permission);
  return { userId: String(user.id), username: user.username };
}
