import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";

export default async function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkflowEditor appId={id} />;
}
