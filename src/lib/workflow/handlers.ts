import { chatCompletion, chatCompletionStream, extractAnswerContent, parseStreamChunk, sanitizeFinalAnswer, type ChatMessage } from "@/lib/ai/llm";
import { getSingleEmbedding } from "@/lib/ai/embedding";
import { searchVectors } from "@/lib/infra/milvus";
import { getDatasetDataModel, getDatasetModel, getDatasetCollectionModel } from "@/lib/models/dataset";
import { connectMongo } from "@/lib/infra/mongo";
import { resolveEmbeddingRuntimeModel, resolveLlmRuntimeModel } from "@/lib/ai/runtime-model";
import {
  FlowNodeTypeEnum,
  NodeInputKeyEnum,
  NodeOutputKeyEnum,
  DispatchNodeResponseKeyEnum,
  SseResponseEventEnum,
  type WorkflowNodeItemType,
  type WorkflowEdgeItemType,
  type IfElseConditionType,
} from "./constants";
import {
  type RuntimeNodeItemType,
  type RuntimeEdgeItemType,
  type NodeDispatchResult,
  type NodeResponseItemType,
  type DispatchContext,
} from "./types";
import {
  resolveVariableReference,
  getVariableValue,
  valueTypeFormat,
} from "./variables";

interface ModuleDispatchProps {
  ctx: DispatchContext;
  node: RuntimeNodeItemType;
  nodeOutput: (node: RuntimeNodeItemType, result: Record<string, any>) => void;
  streamResponse?: (event: string, data: string | Record<string, any>) => void;
}

type HandlerFn = (props: ModuleDispatchProps) => Promise<NodeDispatchResult>;

function getFallbackOutputKey(node: RuntimeNodeItemType) {
  return node.outputs?.[0]?.key || NodeOutputKeyEnum.answerText;
}

function getLegacyInputKey(node: RuntimeNodeItemType) {
  const connectedInputs = node.inputs.filter((input) => input.showTargetInApp);
  if (connectedInputs.length === 1) {
    return connectedInputs[0].key;
  }
  return undefined;
}

function getConnectedInputValue(
  ctx: DispatchContext,
  node: RuntimeNodeItemType,
  inputKey: string,
  nodesMap?: Map<string, RuntimeNodeItemType>
) {
  const legacyInputKey = getLegacyInputKey(node);
  const edges = ctx.runtimeEdges.filter(
    (edge) =>
      edge.target === node.nodeId &&
      (edge.targetHandle === inputKey || (!edge.targetHandle && legacyInputKey === inputKey))
  );

  if (edges.length === 0) return undefined;

  const values = edges
    .map((edge) => {
      const sourceNode = nodesMap?.get(edge.source);
      const sourceKey = edge.sourceHandle || (sourceNode ? getFallbackOutputKey(sourceNode) : undefined);
      if (!sourceKey) return undefined;
      return resolveVariableReference([edge.source, sourceKey], ctx.variables, nodesMap, ctx.nodeOutputMap);
    })
    .filter((item) => item !== undefined);

  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

export function getNodeRunParams(
  ctx: DispatchContext,
  node: RuntimeNodeItemType,
  variables: Record<string, any>,
  nodesMap?: Map<string, RuntimeNodeItemType>
): Record<string, any> {
  const params: Record<string, any> = {};

  for (const input of node.inputs) {
    const connectedValue = getConnectedInputValue(ctx, node, input.key, nodesMap);
    if (connectedValue !== undefined) {
      params[input.key] = connectedValue;
      continue;
    }

    const rawValue = input.value ?? input.defaultValue ?? "";
    params[input.key] = resolveVariableReference(rawValue, variables, nodesMap, ctx.nodeOutputMap);
  }

  return params;
}

function getHistories(historyCount: any, ctx: DispatchContext): Array<{ obj: "Human" | "AI"; value: string }> {
  const rounds = typeof historyCount === "number" ? historyCount : 3;
  const messageCount = rounds * 2; // Each round = 1 Human + 1 AI message
  return ctx.histories.slice(-Math.min(messageCount, ctx.histories.length));
}

function normalizeTextInput(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    const textList = value
      .map((item) => normalizeTextInput(item, ""))
      .map((item) => item.trim())
      .filter(Boolean);
    return textList.length > 0 ? textList.join("\n") : fallback;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidateKeys = ["text", "content", "value", "query", "question", "answerText"];

    for (const key of candidateKeys) {
      const candidate = record[key];
      const normalized = normalizeTextInput(candidate, "");
      if (normalized.trim()) {
        return normalized;
      }
    }

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function isDatasetQuoteLike(value: unknown): boolean {
  if (!value) return false;

  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    return value.every((item) => isDatasetQuoteLike(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return typeof record.q === "string" || typeof record.datasetId === "string" || typeof record.collectionId === "string";
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!(text.startsWith("{") || text.startsWith("["))) return false;
    try {
      const parsed = JSON.parse(text);
      return isDatasetQuoteLike(parsed);
    } catch {
      return false;
    }
  }

  return false;
}

function resolveUserInput(paramValue: unknown, ctxUserInput: unknown): string {
  if (isDatasetQuoteLike(paramValue)) {
    return normalizeTextInput(ctxUserInput, "").trim();
  }

  const paramText = normalizeTextInput(paramValue, "").trim();
  if (paramText) return paramText;

  return normalizeTextInput(ctxUserInput, "").trim();
}

// ═══════════════════════════════════════════════
// System / No-op nodes
// ═══════════════════════════════════════════════

async function dispatchWorkflowStart(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx } = props;
  const userChatInput = normalizeTextInput(ctx.userChatInput || ctx.query || "", "");
  return {
    data: {
      [NodeOutputKeyEnum.answerText]: userChatInput,
    },
    nodeResponse: {
      nodeId: props.node.nodeId,
      moduleName: props.node.name,
      moduleType: props.node.flowNodeType,
    },
  };
}

async function dispatchSystemConfig(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  return {
    data: { ...props.ctx.variables },
    nodeResponse: {
      nodeId: props.node.nodeId,
      moduleName: props.node.name,
      moduleType: props.node.flowNodeType,
    },
  };
}

function dispatchNoop(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  return Promise.resolve({
    data: {},
    nodeResponse: {
      nodeId: props.node.nodeId,
      moduleName: props.node.name,
      moduleType: props.node.flowNodeType,
    },
  });
}

// ═══════════════════════════════════════════════
// Chat Node (LLM)
// ═══════════════════════════════════════════════

async function dispatchChatNode(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const llmModel = await resolveLlmRuntimeModel(params[NodeInputKeyEnum.aiModel]);
  const model = llmModel.model;
  const systemPrompt = params[NodeInputKeyEnum.aiSystemPrompt] || llmModel.defaultSystemPrompt || "";
  const temperature = params[NodeInputKeyEnum.aiTemperature] ?? 0.7;
  const maxToken = params[NodeInputKeyEnum.aiMaxToken] ?? 32000;
  const userChatInput = resolveUserInput(
    params[NodeInputKeyEnum.userChatInput],
    ctx.userChatInput
  );
  const history = params[NodeInputKeyEnum.history];
  const isResponseAnswerText = params[NodeInputKeyEnum.isResponseAnswerText] !== false;
  // Priority: connected edge value > global variables > empty
  // Note: params may return [] (empty array from default value), which blocks ?? fallback.
  // So we must explicitly check for empty arrays.
  let quoteQA = params[NodeOutputKeyEnum.datasetQuoteQA];
  if (!quoteQA || (Array.isArray(quoteQA) && quoteQA.length === 0)) {
    quoteQA = ctx.variables[NodeOutputKeyEnum.datasetQuoteQA];
  }
  if (typeof quoteQA === "string") {
    try {
      const parsed = JSON.parse(quoteQA);
      if (Array.isArray(parsed)) {
        quoteQA = parsed;
      }
    } catch {}
  }

  const quoteText =
    quoteQA && Array.isArray(quoteQA) && quoteQA.length > 0
      ? quoteQA
          .map((q: any, i: number) => `[${i + 1}] ${q.q}${q.a ? ` - ${q.a}` : ""}`)
          .join("\n")
      : "";

  const knowledgeGuideText = quoteText
    ? ["知识库参考资料：", quoteText]
        .filter(Boolean)
        .join("\n\n")
    : "";

  const systemContent = [systemPrompt, knowledgeGuideText]
    .map((item) => normalizeTextInput(item, "").trim())
    .filter(Boolean)
    .join("\n\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemContent || "你是一个有帮助的 AI 助手。",
    },
  ];

  const chatHistories = getHistories(history, ctx);
  for (const h of chatHistories) {
    messages.push({
      role: h.obj === "Human" ? "user" as const : "assistant" as const,
      content: h.value,
    });
  }

  messages.push({ role: "user", content: userChatInput });

  const llmRequestParams = {
    model,
    messages,
    temperature,
    max_tokens: maxToken,
    stream: false,
  };

  const llmStartTime = Date.now();
  
  // Check if we have a stream callback for real-time updates
  const streamCallback = ctx.streamCallback;
  let actualLlmRequest = llmRequestParams;
  
  let fullContent = "";
  let thinkingContent = "";
  let answerContent = "";
  let totalTokens = 0;
  
  if (streamCallback) {
    // Use streaming for real-time updates
    const streamReqParams = { ...llmRequestParams, stream: true };
    actualLlmRequest = streamReqParams;
    const stream = await chatCompletionStream(streamReqParams, {
      baseUrl: llmModel.baseUrl,
      apiKey: llmModel.apiKey,
      model: llmModel.model,
      defaultConfig: llmModel.defaultConfig
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamedRawContent = "";
    let sawReasoningChunk = false;
    let sawAnswerChunk = false;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.trim() || line.startsWith("data: [DONE]")) continue;
        const chunk = parseStreamChunk(line);
        if (!chunk) continue;
        
        if (chunk.reasoning_content) {
          sawReasoningChunk = true;
          streamedRawContent += chunk.reasoning_content;
          thinkingContent += chunk.reasoning_content;
          streamCallback("thinking", { content: chunk.reasoning_content });
        }
        
        if (chunk.content) {
          sawAnswerChunk = true;
          streamedRawContent += chunk.content;
          answerContent += chunk.content;
          streamCallback("answer", { content: chunk.content });
        }
        
        if (chunk.finish_reason === "stop") {
          break;
        }
      }
    }

    fullContent = streamedRawContent.trim();

    const canParseMixedContent = sawAnswerChunk || /<think>[\s\S]*?<\/think>/i.test(fullContent);
    if (canParseMixedContent) {
      const extracted = extractAnswerContent(
        fullContent || (thinkingContent ? `<think>${thinkingContent}</think>${answerContent}` : answerContent)
      );

      if (extracted.thinking) {
        thinkingContent = extracted.thinking;
      }
      answerContent = sanitizeFinalAnswer(extracted.answer, thinkingContent);
    } else if (!sawReasoningChunk && fullContent) {
      answerContent = sanitizeFinalAnswer(fullContent, thinkingContent);
    }
  } else {
    // Non-streaming fallback
    const result = await chatCompletion(llmRequestParams, {
      baseUrl: llmModel.baseUrl,
      apiKey: llmModel.apiKey,
      model: llmModel.model,
      defaultConfig: llmModel.defaultConfig
    });
    fullContent = result.choices[0]?.message?.content || "";
    totalTokens = result.usage?.total_tokens || 0;
    
    const extracted = extractAnswerContent(fullContent);
    thinkingContent = extracted.thinking;
    answerContent = sanitizeFinalAnswer(extracted.answer, thinkingContent);
  }
  
  const llmDuration = +((Date.now() - llmStartTime) / 1000).toFixed(2);

  const llmApiUrl = llmModel.baseUrl.replace(/\/$/, "") + "/chat/completions";

  return {
    data: {
      [NodeOutputKeyEnum.answerText]: isResponseAnswerText ? answerContent : "",
    },
    answerText: isResponseAnswerText ? answerContent : "",
    reasoningText: thinkingContent || undefined,
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
      model,
      tokens: totalTokens,
      query: userChatInput,
      llmRequest: actualLlmRequest,
      llmResponse: {
        thinking: thinkingContent,
        answer: answerContent,
        rawContent: fullContent,
      },
      apiRequests: [
        {
          type: "llm",
          name: "Chat Completion API",
          url: llmApiUrl,
          method: "POST",
          duration: llmDuration,
          status: "success",
        },
      ],
    },
  };
}

// ═══════════════════════════════════════════════
// Dataset Search Node
// ═══════════════════════════════════════════════

async function dispatchDatasetSearch(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const datasets = params[NodeInputKeyEnum.datasetSelectList] || [];
  const similarity = params[NodeInputKeyEnum.datasetSimilarity] ?? 0.4;
  const limit = params[NodeInputKeyEnum.datasetMaxTokens] ?? 5000;
  const userQuery = resolveUserInput(
    params[NodeInputKeyEnum.userChatInput],
    ctx.userChatInput
  );

  if (datasets.length === 0) {
    return {
      data: { [NodeOutputKeyEnum.datasetQuoteQA]: [] },
      nodeResponse: {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
        query: userQuery,
        total: 0,
      },
    };
  }

  const embeddingModelId = String(datasets[0]?.embeddingModelId || "");
  if (!embeddingModelId) {
    throw new Error("知识库未绑定嵌入模型");
  }
  const hasMixedEmbeddingModel = datasets.some(
    (item: any) => String(item?.embeddingModelId || "") !== embeddingModelId
  );
  if (hasMixedEmbeddingModel) {
    throw new Error("同一个知识库检索节点暂不支持混用不同嵌入模型的知识库");
  }
  const embeddingModel = await resolveEmbeddingRuntimeModel(embeddingModelId);
  
  const apiRequests: Array<any> = [];
  
  // Embedding API call
  const embeddingStartTime = Date.now();
  let vector: number[];
  try {
    vector = await getSingleEmbedding(embeddingModel.model, userQuery, {
      baseUrl: embeddingModel.baseUrl,
      apiKey: embeddingModel.apiKey,
      model: embeddingModel.model,
      defaultConfig: embeddingModel.defaultConfig
    });
    const embeddingDuration = +((Date.now() - embeddingStartTime) / 1000).toFixed(2);
    const embeddingUrl = embeddingModel.baseUrl.replace(/\/$/, "") + "/embeddings";
    apiRequests.push({
      type: "embedding",
      name: "Embedding API",
      url: embeddingUrl,
      method: "POST",
      body: { model: embeddingModel.model, input: userQuery },
      response: {
        vector: `[${vector.slice(0, 5).join(",")}...] (dim=${vector.length})`,
        dimension: vector.length,
      },
      duration: embeddingDuration,
      status: "success",
    });
  } catch (err) {
    apiRequests.push({
      type: "embedding",
      name: "Embedding API",
      url: embeddingModel.baseUrl.replace(/\/$/, "") + "/embeddings",
      method: "POST",
      body: { model: embeddingModel.model, input: userQuery },
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  
  const datasetIds = datasets
    .map((d: any) => (typeof d === "string" ? d : d?.datasetId || d?.id || d?._id))
    .filter(Boolean);

  // Vector search API call
  const vectorSearchStartTime = Date.now();
  const searchResults = await searchVectors({
    teamId: ctx.userId,
    embeddingModelId,
    vector,
    topK: 20,
    datasetIds,
  });
  const vectorSearchDuration = +((Date.now() - vectorSearchStartTime) / 1000).toFixed(2);
  
  apiRequests.push({
    type: "vector_search",
    name: "Milvus Vector Search",
    url: process.env.MILVUS_ADDRESS || "",
    method: "SDK",
    body: {
      collection: `kb_${ctx.userId.replace(/-/g, "").slice(0, 20)}`,
      vector: `[${vector.slice(0, 5).join(",")}...] (dim=${vector.length})`,
      topK: 20,
      datasetIds,
    },
    response: {
      total: searchResults.length,
      results: searchResults.slice(0, 10).map((r: any) => ({
        dataId: r.dataId,
        score: r.score,
        datasetId: r.datasetId,
        collectionId: r.collectionId,
      })),
    },
    duration: vectorSearchDuration,
    status: "success",
  });

  const filteredResults = searchResults.filter((r: any) => r.score >= similarity);

  await connectMongo();
  const DatasetData = await getDatasetDataModel();
  const Dataset = await getDatasetModel();
  const DatasetCollection = await getDatasetCollectionModel();
  
  const dataIds = filteredResults.map((r: any) => r.dataId);
  const dataRecords = await DatasetData.find({ _id: { $in: dataIds } }).lean();
  
  // Query dataset and collection names
  const uniqueDatasetIds = [...new Set(filteredResults.map((r: any) => r.datasetId))];
  const uniqueCollectionIds = [...new Set(filteredResults.map((r: any) => r.collectionId))];
  
  const datasetRecords = await Dataset.find({ _id: { $in: uniqueDatasetIds } }).lean();
  const collectionRecords = await DatasetCollection.find({ _id: { $in: uniqueCollectionIds } }).lean();
  
  const datasetNameMap = new Map(datasetRecords.map((d: any) => [String(d._id), d.name]));
  const collectionNameMap = new Map(collectionRecords.map((c: any) => [String(c._id), c.name]));

  // Update Milvus search response with detailed results
  apiRequests[apiRequests.length - 1].response = {
    total: searchResults.length,
    filtered: filteredResults.length,
    results: filteredResults.slice(0, 10).map((r: any) => ({
      dataId: r.dataId,
      score: r.score,
      datasetId: r.datasetId,
      datasetName: datasetNameMap.get(r.datasetId) || "Unknown",
      collectionId: r.collectionId,
      collectionName: collectionNameMap.get(r.collectionId) || "Unknown",
    })),
  };

  const quoteQA = filteredResults
    .map((r: any) => {
      const data = dataRecords.find((d: any) => String(d._id) === r.dataId);
      if (!data) return null;
      return {
        id: r.dataId,
        q: data.q,
        a: (data as any).a || "",
        score: r.score,
        datasetId: r.datasetId,
        collectionId: r.collectionId,
      };
    })
    .filter(Boolean)
    .slice(0, Math.max(1, Math.floor(limit / 500)));

  // Database query API call
  const dbStartTime = Date.now();
  const dbDuration = +((Date.now() - dbStartTime) / 1000).toFixed(2);
  apiRequests.push({
    type: "database",
    name: "MongoDB Query",
    url: process.env.MONGODB_URI || "MongoDB",
    method: "find",
    body: {
      collection: "dataset_datas",
      filter: { _id: { $in: dataIds } },
    },
    response: {
      total: dataRecords.length,
      documents: dataRecords.slice(0, 10).map((d: any) => ({
        id: String(d._id),
        q: d.q?.slice(0, 100) + (d.q?.length > 100 ? "..." : ""),
        a: d.a?.slice(0, 100) + (d.a?.length > 100 ? "..." : ""),
        datasetId: String(d.datasetId),
        collectionId: String(d.collectionId),
        chunkIndex: d.chunkIndex,
      })),
    },
    duration: dbDuration,
    status: "success",
  });

  return {
    data: { [NodeOutputKeyEnum.datasetQuoteQA]: quoteQA },
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
      query: userQuery,
      total: quoteQA.length,
      apiRequests,
    },
  };
}

// ═══════════════════════════════════════════════
// Dataset Concat Node
// ═══════════════════════════════════════════════

async function dispatchDatasetConcat(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);
  const maxLimit = params[NodeInputKeyEnum.datasetMaxTokens] ?? 5000;

  const allQuotes: any[] = [];
  for (const input of node.inputs) {
    const value = params[input.key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && item.q) {
          const exists = allQuotes.find((q) => q.id === item.id);
          if (!exists) allQuotes.push(item);
        }
      }
    }
  }

  const merged = allQuotes
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, Math.floor(maxLimit / 500));

  return {
    data: { [NodeOutputKeyEnum.datasetQuoteQA]: merged },
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
      concatLength: merged.length,
    },
  };
}

// ═══════════════════════════════════════════════
// Answer Node
// ═══════════════════════════════════════════════

async function dispatchAnswer(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  let text = params[NodeOutputKeyEnum.answerText] || "";

  const quoteQA = ctx.variables[NodeOutputKeyEnum.datasetQuoteQA];
  if (quoteQA && Array.isArray(quoteQA) && quoteQA.length > 0) {
    const quoteText = quoteQA
      .map((q: any, i: number) => `[${i + 1}] Q: ${q.q}\nA: ${q.a || ""}`)
      .join("\n\n");
    text = resolveVariableReference(text, {
      ...ctx.variables,
      quoteQA: quoteText,
    });
  }

  return {
    data: { [NodeOutputKeyEnum.answerText]: text },
    answerText: text,
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
    },
  };
}

// ═══════════════════════════════════════════════
// Classify Question Node
// ═══════════════════════════════════════════════

async function dispatchClassifyQuestion(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const llmModel = await resolveLlmRuntimeModel(params[NodeInputKeyEnum.aiModel]);
  const model = llmModel.model;
  const systemPrompt = params[NodeInputKeyEnum.aiSystemPrompt] || llmModel.defaultSystemPrompt || "";
  const userChatInput = resolveUserInput(
    params[NodeInputKeyEnum.userChatInput],
    ctx.userChatInput
  );
  const agents = params[NodeInputKeyEnum.agents] || [];
  const history = params[NodeInputKeyEnum.history];

  if (!userChatInput) {
    return {
      data: {},
      error: { [NodeOutputKeyEnum.errorText]: "Input is empty" },
      skipHandleId: agents.map((item: any) => `${node.nodeId}-source-${item.key}`),
      nodeResponse: {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
        error: "Input is empty",
      },
    };
  }

  const optionsDesc = agents
    .map((item: any) => `- ${item.key}: ${item.value}`)
    .join("\n");

  const classifyPrompt = `${systemPrompt || "请将用户问题分类到以下类别之一"}\n\n可选类别:\n${optionsDesc}\n\n请只回复类别 key, 不要额外文字。`;

  const chatHistories = getHistories(history, ctx);
  const messages: ChatMessage[] = [
    { role: "system", content: classifyPrompt },
    ...chatHistories.map((h) => ({
      role: (h.obj === "Human" ? "user" : "assistant") as "user" | "assistant",
      content: h.value,
    })),
    { role: "user", content: userChatInput },
  ];

  const result = await chatCompletion(
    {
      model,
      messages,
      temperature: 0.01,
      max_tokens: 100,
    },
    {
      baseUrl: llmModel.baseUrl,
      apiKey: llmModel.apiKey,
      model: llmModel.model,
      defaultConfig: llmModel.defaultConfig
    }
  );

  const answer = (result.choices[0]?.message?.content || "").trim();
  const matched = agents.find((item: any) => answer.includes(item.key)) || agents[agents.length - 1];
  const cqResult = matched?.value || "";

  return {
    data: {
      [NodeOutputKeyEnum.cqResult]: cqResult,
    },
    skipHandleId: agents
      .filter((item: any) => item.key !== matched?.key)
      .map((item: any) => `${node.nodeId}-source-${item.key}`),
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
      model,
      query: userChatInput,
      cqResult,
      cqList: agents.map((item: any) => ({ key: item.key, value: item.value })),
    },
  };
}

// ═══════════════════════════════════════════════
// Content Extract Node
// ═══════════════════════════════════════════════

async function dispatchContentExtract(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const llmModel = await resolveLlmRuntimeModel(params[NodeInputKeyEnum.aiModel]);
  const model = llmModel.model;
  const content = resolveUserInput(
    params[NodeInputKeyEnum.userChatInput],
    ctx.userChatInput
  );
  const extractKeys = params[NodeInputKeyEnum.extractFields] || [];
  const description = params["description" as string] || "";
  const history = params[NodeInputKeyEnum.history];

  if (!content) {
    return {
      data: {},
      error: { [NodeOutputKeyEnum.errorText]: "Input is empty" },
      skipHandleId: undefined,
      nodeResponse: {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
        error: "Input is empty",
      },
    };
  }

  const fieldsDesc = extractKeys
    .map((item: any) => `- ${item.key}: ${item.desc || ""}`)
    .join("\n");

  const extractPrompt = `Extract information from the text below. Return a JSON object with the following fields:

${fieldsDesc}

Return ONLY a valid JSON object, no markdown code blocks or explanation.`;

  const chatHistories = getHistories(history, ctx);
  const messages: ChatMessage[] = [
    { role: "system", content: extractPrompt },
    ...chatHistories.map((h) => ({
      role: (h.obj === "Human" ? "user" : "assistant") as "user" | "assistant",
      content: h.value,
    })),
    { role: "user", content },
  ];

  const result = await chatCompletion(
    {
      model,
      messages,
      temperature: 0.01,
      max_tokens: 2000,
    },
    {
      baseUrl: llmModel.baseUrl,
      apiKey: llmModel.apiKey,
      model: llmModel.model,
      defaultConfig: llmModel.defaultConfig
    }
  );

  const rawText = result.choices[0]?.message?.content || "";
  let extracted: Record<string, any> = {};

  try {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      extracted = JSON.parse(match[0]);
    }
  } catch {
    extracted = {};
  }

  const success = extractKeys.every((item: any) => item.key in extracted) && !extractKeys.length;

  return {
    data: {
      [NodeOutputKeyEnum.extractResult]: JSON.stringify(extracted),
      ...extracted,
    },
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
      model,
      query: content,
      extractResult: extracted,
      extractDescription: description,
    },
  };
}

// ═══════════════════════════════════════════════
// If-Else Node
// ═══════════════════════════════════════════════

function evaluateCondition(a: string, condition: string, b: string): boolean {
  switch (condition) {
    case "eq": return String(a) === String(b);
    case "neq": return String(a) !== String(b);
    case "gt": return Number(a) > Number(b);
    case "gte": return Number(a) >= Number(b);
    case "lt": return Number(a) < Number(b);
    case "lte": return Number(a) <= Number(b);
    case "contains": return String(a).includes(String(b));
    case "not_contains": return !String(a).includes(String(b));
    case "empty": return !a || String(a).trim() === "";
    case "notEmpty": return !!a && String(a).trim() !== "";
    default: return false;
  }
}

async function dispatchIfElse(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const ifElseList = params[NodeInputKeyEnum.ifElseList] || [];
  const outgoingHandleIds = Array.from(
    new Set(
      ctx.runtimeEdges
        .filter((edge) => edge.source === node.nodeId)
        .map((edge) => edge.sourceHandle || "")
        .filter(Boolean)
    )
  );

  for (let i = 0; i < ifElseList.length; i++) {
    const item = ifElseList[i];
    const conditions: IfElseConditionType[] = item.conditions || [];
    const logic = item.condition || "AND";

    if (conditions.length === 0) continue;

    const results = conditions.map((cond: IfElseConditionType) => {
      const varValue = getVariableValue(ctx.variables, cond.variable) ?? "";
      return evaluateCondition(String(varValue), cond.condition, cond.value);
    });

    const passed = logic === "AND" ? results.every(Boolean) : results.some(Boolean);

    if (passed) {
      const handleId = `ifElse-result-${i}`;
      return {
        data: { [NodeOutputKeyEnum.ifElseResult]: `IF_${i}` },
        skipHandleId: outgoingHandleIds.filter((id) => id !== handleId),
        nodeResponse: {
          nodeId: node.nodeId,
          moduleName: node.name,
          moduleType: node.flowNodeType,
        },
      };
    }
  }

  const defaultHandleId = "ifElse-else";
  return {
    data: { [NodeOutputKeyEnum.ifElseResult]: "ELSE" },
    skipHandleId: outgoingHandleIds.filter((id) => id !== defaultHandleId),
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
    },
  };
}

// ═══════════════════════════════════════════════
// HTTP Request Node
// ═══════════════════════════════════════════════

async function dispatchHttpRequest(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const url = params[NodeInputKeyEnum.httpReqUrl] || "";
  const method = (params[NodeInputKeyEnum.httpMethod] || "GET").toUpperCase();
  const headersInput = params[NodeInputKeyEnum.httpHeaders] || [];
  const body = params[NodeInputKeyEnum.httpJsonBody];
  const timeout = params[NodeInputKeyEnum.httpTimeout] || 30;

  const headers: Record<string, string> = {};
  for (const h of headersInput) {
    if (h.key && h.value) headers[h.key] = h.value;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout * 1000);

  const apiRequests: Array<any> = [];

  try {
    const httpStartTime = Date.now();
    const res = await fetch(url, {
      method,
      headers,
      body: method !== "GET" && body
        ? (typeof body === "string" ? body : JSON.stringify(body))
        : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const httpDuration = +((Date.now() - httpStartTime) / 1000).toFixed(2);
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = text; }

    apiRequests.push({
      type: "http",
      name: `HTTP ${method}`,
      url,
      method,
      headers,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      response: {
        statusCode: res.status,
        contentType: res.headers.get("content-type"),
        bodyPreview: typeof json === "string" ? json.slice(0, 500) : json,
      },
      duration: httpDuration,
      status: res.ok ? "success" : "error",
      error: res.ok ? undefined : `HTTP ${res.status}`,
    });

    return {
      data: { [NodeOutputKeyEnum.httpResult]: json },
      nodeResponse: {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
        statusCode: res.status,
        url,
        method,
        apiRequests,
      },
    };
  } catch (err) {
    clearTimeout(timer);
    apiRequests.push({
      type: "http",
      name: `HTTP ${method}`,
      url,
      method,
      headers,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      data: {},
      error: { [NodeOutputKeyEnum.errorText]: `HTTP request failed: ${err instanceof Error ? err.message : String(err)}` },
      nodeResponse: {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
        error: `HTTP request failed: ${err instanceof Error ? err.message : String(err)}`,
        apiRequests,
      },
    };
  }
}

// ═══════════════════════════════════════════════
// Code Node (Code Sandbox)
// ═══════════════════════════════════════════════

async function dispatchCode(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const code = params[NodeInputKeyEnum.code] || "";
  const sandboxUrl = process.env.CODE_SANDBOX_URL;

  if (!sandboxUrl) {
    return {
      data: {},
      error: { [NodeOutputKeyEnum.errorText]: "Code sandbox is not configured" },
      nodeResponse: {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
        error: "CODE_SANDBOX_URL is not configured",
      },
    };
  }

  const res = await fetch(`${sandboxUrl}/sandbox/js`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      variables: ctx.variables,
    }),
  });

  const apiRequests: Array<any> = [{
    type: "sandbox",
    name: "Code Sandbox API",
    url: `${sandboxUrl}/sandbox/js`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { code, variables: ctx.variables },
    response: { statusCode: res.status },
    status: res.ok ? "success" : "error",
    error: res.ok ? undefined : `HTTP ${res.status}`,
  }];

  if (!res.ok) {
    return {
      data: {},
      error: { [NodeOutputKeyEnum.errorText]: `Code execution failed: ${res.status}` },
      nodeResponse: {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
        error: `Code execution failed: ${res.status}`,
        apiRequests,
      },
    };
  }

  const result = await res.json();
  return {
    data: { [NodeOutputKeyEnum.codeResult]: result.result },
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
      apiRequests,
    },
  };
}

// ═══════════════════════════════════════════════
// Variable Update Node
// ═══════════════════════════════════════════════

async function dispatchVariableUpdate(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const updateList = params[NodeInputKeyEnum.variableUpdateList] || [];

  for (const item of updateList) {
    const varPath: string[] = item.variable || [];
    const value = item.value;
    if (varPath.length === 0) continue;

    let current: any = ctx.variables;
    for (let i = 0; i < varPath.length - 1; i++) {
      if (!current[varPath[i]]) current[varPath[i]] = {};
      current = current[varPath[i]];
    }
    current[varPath[varPath.length - 1]] = value;
  }

  return {
    data: {},
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
    },
  };
}

// ═══════════════════════════════════════════════
// Text Editor Node
// ═══════════════════════════════════════════════

async function dispatchTextEditor(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const template = params[NodeInputKeyEnum.textEditorTemplate] || "";
  const inputList = params[NodeInputKeyEnum.textEditorInputList] || [];

  let result = template;
  for (const item of inputList) {
    const key = item.key || "";
    const value = resolveVariableReference(String(item.value || ""), ctx.variables);
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return {
    data: { [NodeOutputKeyEnum.textEditorResult]: result },
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
    },
  };
}

// ═══════════════════════════════════════════════
// Read Files Node
// ═══════════════════════════════════════════════

async function dispatchReadFiles(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const fileUrlList: string[] = params[NodeInputKeyEnum.readFilesUrlList] || [];

  if (fileUrlList.length === 0) {
    return {
      data: { [NodeOutputKeyEnum.fileContent]: "" },
      nodeResponse: {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
        readFiles: [],
      },
    };
  }

  const results: Array<{ filename: string; url: string; content: string }> = [];

  for (const url of fileUrlList.slice(0, 20)) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        results.push({ filename: url, url, content: `Failed to fetch: ${res.status}` });
        continue;
      }
      const text = await res.text();
      const filename = url.split("/").pop() || url;
      results.push({ filename, url, content: text.slice(0, 50000) });
    } catch (err) {
      results.push({ filename: url, url, content: `Error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  const combined = results
    .map((r) => `File: ${r.filename}\n<Content>\n${r.content}\n</Content>`)
    .join("\n\n******\n\n");

  return {
    data: { [NodeOutputKeyEnum.fileContent]: combined },
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
      readFiles: results.map((r) => ({ name: r.filename, url: r.url })),
    },
  };
}

// ═══════════════════════════════════════════════
// Agent Node (simplified - basic tool calling)
// ═══════════════════════════════════════════════

async function dispatchAgent(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const nodesMap = ctx.runtimeNodesMap;
  const params = getNodeRunParams(ctx, node, ctx.variables, nodesMap);

  const llmModel = await resolveLlmRuntimeModel(params[NodeInputKeyEnum.aiModel]);
  const model = llmModel.model;
  const systemPrompt = params[NodeInputKeyEnum.aiSystemPrompt] || llmModel.defaultSystemPrompt || "";
  const userChatInput = resolveUserInput(
    params[NodeInputKeyEnum.userChatInput],
    ctx.userChatInput
  );
  const history = params[NodeInputKeyEnum.history];

  const chatHistories = getHistories(history, ctx);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt || "You are a helpful AI assistant." },
    ...chatHistories.map((h) => ({
      role: (h.obj === "Human" ? "user" : "assistant") as "user" | "assistant",
      content: h.value,
    })),
    { role: "user", content: userChatInput },
  ];

  const result = await chatCompletion(
    {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    },
    {
      baseUrl: llmModel.baseUrl,
      apiKey: llmModel.apiKey,
      model: llmModel.model,
      defaultConfig: llmModel.defaultConfig
    }
  );

  const content = result.choices[0]?.message?.content || "";

  return {
    data: {
      [NodeOutputKeyEnum.agentResponse]: content,
      [NodeOutputKeyEnum.answerText]: content,
    },
    answerText: content,
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
      model,
      tokens: result.usage?.total_tokens || 0,
      query: userChatInput,
    },
  };
}

// ═══════════════════════════════════════════════
// Form Input Node (interactive)
// ═══════════════════════════════════════════════

async function dispatchFormInput(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const params = getNodeRunParams(ctx, node, ctx.variables, ctx.runtimeNodesMap);

  const userInputForms = params["userInputForms"] || [];
  const description = params["description"] || "";

  return {
    data: {},
    interactive: {
      type: "formInput",
      params: { description, inputForm: userInputForms },
    },
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
    },
  };
}

// ═══════════════════════════════════════════════
// User Select Node (interactive)
// ═══════════════════════════════════════════════

async function dispatchUserSelect(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const params = getNodeRunParams(ctx, node, ctx.variables, ctx.runtimeNodesMap);

  const userSelectOptions = params["userSelectOptions"] || [];
  const description = params["description"] || "";

  return {
    data: {},
    interactive: {
      type: "userSelect",
      params: { description, userSelectOptions },
    },
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
    },
  };
}

// ═══════════════════════════════════════════════
// Custom Feedback Node
// ═══════════════════════════════════════════════

async function dispatchCustomFeedback(props: ModuleDispatchProps): Promise<NodeDispatchResult> {
  const { ctx, node } = props;
  const params = getNodeRunParams(ctx, node, ctx.variables, ctx.runtimeNodesMap);

  const feedbackText = params["feedbackText"] || "Workflow execution completed successfully.";

  return {
    data: { [NodeOutputKeyEnum.customFeedbackResult]: feedbackText },
    customFeedbacks: [feedbackText],
    nodeResponse: {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
    },
  };
}

// ═══════════════════════════════════════════════
// Dispatch Map
// ═══════════════════════════════════════════════

export const dispatchMap: Record<string, HandlerFn> = {
  [FlowNodeTypeEnum.workflowStart]: dispatchWorkflowStart,
  [FlowNodeTypeEnum.systemConfig]: dispatchSystemConfig,
  [FlowNodeTypeEnum.emptyNode]: dispatchNoop,
  [FlowNodeTypeEnum.comment]: dispatchNoop,
  [FlowNodeTypeEnum.globalVariable]: dispatchNoop,

  [FlowNodeTypeEnum.chatNode]: dispatchChatNode,
  [FlowNodeTypeEnum.answerNode]: dispatchAnswer,
  [FlowNodeTypeEnum.datasetSearchNode]: dispatchDatasetSearch,
  [FlowNodeTypeEnum.datasetConcatNode]: dispatchDatasetConcat,

  [FlowNodeTypeEnum.agent]: dispatchAgent,
  [FlowNodeTypeEnum.classifyQuestion]: dispatchClassifyQuestion,
  [FlowNodeTypeEnum.contentExtract]: dispatchContentExtract,

  [FlowNodeTypeEnum.httpRequest468]: dispatchHttpRequest,
  [FlowNodeTypeEnum.code]: dispatchCode,
  [FlowNodeTypeEnum.textEditor]: dispatchTextEditor,
  [FlowNodeTypeEnum.readFiles]: dispatchReadFiles,

  [FlowNodeTypeEnum.ifElseNode]: dispatchIfElse,
  [FlowNodeTypeEnum.variableUpdate]: dispatchVariableUpdate,

  [FlowNodeTypeEnum.formInput]: dispatchFormInput,
  [FlowNodeTypeEnum.userSelect]: dispatchUserSelect,
  [FlowNodeTypeEnum.customFeedback]: dispatchCustomFeedback,
};
