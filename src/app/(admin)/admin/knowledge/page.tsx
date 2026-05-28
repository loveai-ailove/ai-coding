import { KnowledgeList } from "@/components/knowledge/KnowledgeList";

export default function KnowledgePage() {
  return (
    <KnowledgeList
      defaultEmbeddingModel={process.env.DEFAULT_EMBEDDING_MODEL || "text-embedding-3-small"}
      defaultLlmModel={process.env.DEFAULT_LLM_MODEL || "qwen-max"}
    />
  );
}
