import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireKnowledgePermission } from "@/lib/auth/fastgpt-auth";
import { searchDataset } from "@/lib/services/dataset-search";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireKnowledgePermission("knowledge:read");
    const { id } = await params;

    const body = await request.json();
    const { query, datasetIds, similarity, limit, vectorModel } = body;

    if (!query || !query.trim()) {
      throw new Error("搜索内容不能为空");
    }

    const searchIds = Array.isArray(datasetIds) && datasetIds.length > 0
      ? datasetIds
      : [id];

    const results = await searchDataset({
      userId: user.userId,
      datasetIds: searchIds,
      query: query.trim(),
      similarity: similarity ?? 0.4,
      limit: limit ?? 20,
      vectorModel,
    });

    return NextResponse.json({
      list: results.map((item) => ({
        id: item.id,
        q: item.q,
        a: item.a,
        score: Math.round(item.score * 10000) / 10000,
        datasetId: item.datasetId,
        collectionId: item.collectionId,
      })),
      total: results.length,
    });
  } catch (error) {
    return handleApiError(error, "搜索失败");
  }
}
