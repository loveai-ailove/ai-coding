import { KnowledgeDetail } from "@/components/knowledge/KnowledgeDetail";

export default async function KnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KnowledgeDetail datasetId={id} />;
}
