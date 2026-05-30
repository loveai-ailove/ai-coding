import { hasPermission, requirePermission } from "@/lib/auth/permission";
import { listAiModels } from "@/lib/ai/model-manager";
import { AiModelManager } from "@/components/system/AiModelManager";

export default async function AiModelsPage() {
  const user = await requirePermission("model:read");
  const models = await listAiModels();

  return (
    <AiModelManager
      initialModels={models}
      permissions={{
        create: hasPermission(user, "model:create"),
        update: hasPermission(user, "model:update"),
        delete: hasPermission(user, "model:delete")
      }}
    />
  );
}
