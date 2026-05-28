import { chatCompletion, type ChatMessage } from "@/lib/ai/llm";
import { getSingleEmbedding } from "@/lib/ai/embedding";
import { searchVectors } from "@/lib/infra/milvus";
import { getDatasetDataModel } from "@/lib/models/dataset";
import { connectMongo } from "@/lib/infra/mongo";
import {
  FlowNodeTypeEnum,
  NodeInputKeyEnum,
  NodeOutputKeyEnum,
  DispatchNodeResponseKeyEnum,
  type WorkflowNodeItemType,
  type WorkflowEdgeItemType,
  type IfElseConditionType,
} from "./constants";

export interface DispatchContext {
  userId: string;
  appId: string;
  variables: Record<string, any>;
  histories: Array<{ obj: "Human" | "AI"; value: string }>;
  userChatInput: string;
  runtimeNodes: RuntimeNode[];
  runtimeEdges: WorkflowEdgeItemType[];
}

export interface RuntimeNode extends WorkflowNodeItemType {
  isEntry: boolean;
  status: "running" | "done" | "error" | "skipped";
  output?: Record<string, any>;
  error?: string;
}

interface NodeDispatchResult {
  output: Record<string, any>;
  responseData?: Record<string, any>;
  [DispatchNodeResponseKeyEnum.skipHandleId]?: string;
}

function getVariableValue(variables: Record<string, any>, path: string[]): any {
  let current: any = variables;
  for (const key of path) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

function resolveInputValue(
  input: WorkflowNodeItemType["inputs"][number],
  variables: Record<string, any>,
  nodeOutputs: Record<string, Record<string, any>>
): any {
  if (input.value !== undefined && input.value !== null) return input.value;
  if (input.defaultValue !== undefined) return input.defaultValue;
  return undefined;
}

async function dispatchChatNode(
  node: WorkflowNodeItemType,
  ctx: DispatchContext
): Promise<NodeDispatchResult> {
  const model = node.inputs.find((i) => i.key === NodeInputKeyEnum.aiModel)?.value || process.env.DEFAULT_LLM_MODEL;
  const systemPrompt = node.inputs.find((i) => i.key === NodeInputKeyEnum.aiSystemPrompt)?.value || "";
  const temperature = node.inputs.find((i) => i.key === NodeInputKeyEnum.aiTemperature)?.value ?? 0.7;
  const maxToken = node.inputs.find((i) => i.key === NodeInputKeyEnum.aiMaxToken)?.value ?? 2000;

  const messages: ChatMessage[] = [];
  const resolvedSystemPrompt = replaceVariables(systemPrompt, ctx.variables);
  if (resolvedSystemPrompt) messages.push({ role: "system", content: resolvedSystemPrompt });
  for (const h of ctx.histories.slice(-10)) {
    messages.push({ role: h.obj === "Human" ? "user" : "assistant", content: h.value });
  }
  const userInput = replaceVariables(
    node.inputs.find((i) => i.key === NodeInputKeyEnum.userChatInput)?.value || ctx.userChatInput,
    ctx.variables
  );
  messages.push({ role: "user", content: userInput });

  const result = await chatCompletion({
    model,
    messages,
    temperature,
    max_tokens: maxToken,
  });

  const content = result.choices[0]?.message?.content || "";
  return {
    output: { [NodeOutputKeyEnum.answerText]: content },
    responseData: {
      model,
      tokens: result.usage?.total_tokens || 0,
      query: userInput,
    },
  };
}

async function dispatchDatasetSearch(
  node: WorkflowNodeItemType,
  ctx: DispatchContext
): Promise<NodeDispatchResult> {
  const datasets = node.inputs.find((i) => i.key === NodeInputKeyEnum.datasetSelectList)?.value || [];
  const similarity = node.inputs.find((i) => i.key === NodeInputKeyEnum.datasetSimilarity)?.value ?? 0.4;
  const limit = node.inputs.find((i) => i.key === NodeInputKeyEnum.datasetMaxTokens)?.value ?? 5000;

  if (datasets.length === 0) {
    return { output: { [NodeOutputKeyEnum.datasetQuoteQA]: [] } };
  }

  const userQuery = replaceVariables(
    node.inputs.find((i) => i.key === NodeInputKeyEnum.userChatInput)?.value || ctx.userChatInput,
    ctx.variables
  );

  const embeddingModel = datasets[0]?.vectorModel || process.env.DEFAULT_EMBEDDING_MODEL;
  const vector = await getSingleEmbedding(embeddingModel, userQuery);
  const datasetIds = datasets.map((d: any) => d.datasetId || d);

  const searchResults = await searchVectors({
    teamId: ctx.userId,
    vector,
    topK: 20,
    datasetIds,
  });

  const filteredResults = searchResults.filter((r) => r.score >= similarity);

  await connectMongo();
  const DatasetData = await getDatasetDataModel();
  const dataIds = filteredResults.map((r) => r.dataId);
  const dataRecords = await DatasetData.find({ _id: { $in: dataIds } }).lean();

  const quoteQA = filteredResults
    .map((r) => {
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
    .slice(0, Math.floor(limit / 500));

  return {
    output: { [NodeOutputKeyEnum.datasetQuoteQA]: quoteQA },
    responseData: { query: userQuery, total: quoteQA.length },
  };
}

async function dispatchAnswer(
  node: WorkflowNodeItemType,
  ctx: DispatchContext
): Promise<NodeDispatchResult> {
  const textInput = node.inputs.find((i) => i.key === NodeOutputKeyEnum.answerText);
  let text = textInput?.value || "";
  text = replaceVariables(text, ctx.variables);

  const quoteQA = ctx.variables[NodeOutputKeyEnum.datasetQuoteQA];
  if (quoteQA && Array.isArray(quoteQA) && quoteQA.length > 0) {
    const quoteText = quoteQA
      .map((q: any, i: number) => `[${i + 1}] ${q.q}${q.a ? `\n${q.a}` : ""}`)
      .join("\n\n");
    text = text.replace(/\{\{quoteQA\}\}/g, quoteText);
  }

  return { output: { [NodeOutputKeyEnum.answerText]: text } };
}

function dispatchIfElse(
  node: WorkflowNodeItemType,
  ctx: DispatchContext
): NodeDispatchResult {
  const ifElseList = node.inputs.find((i) => i.key === NodeInputKeyEnum.ifElseList)?.value || [];

  for (let i = 0; i < ifElseList.length; i++) {
    const item = ifElseList[i];
    const conditions: IfElseConditionType[] = item.conditions || [];
    const logic = item.condition || "AND";

    const results = conditions.map((cond) => {
      const varValue = getVariableValue(ctx.variables, cond.variable) ?? "";
      return evaluateCondition(String(varValue), cond.condition, cond.value);
    });

    const passed = logic === "AND" ? results.every(Boolean) : results.some(Boolean);

    if (passed) {
      const handleId = `ifElse-result-${i}`;
      return {
        output: { [NodeOutputKeyEnum.ifElseResult]: `IF_${i}` },
        [DispatchNodeResponseKeyEnum.skipHandleId]: handleId,
      };
    }
  }

  const defaultHandleId = "ifElse-else";
  return {
    output: { [NodeOutputKeyEnum.ifElseResult]: "ELSE" },
    [DispatchNodeResponseKeyEnum.skipHandleId]: defaultHandleId,
  };
}

async function dispatchHttpRequest(
  node: WorkflowNodeItemType,
  ctx: DispatchContext
): Promise<NodeDispatchResult> {
  const url = replaceVariables(
    node.inputs.find((i) => i.key === NodeInputKeyEnum.httpReqUrl)?.value || "",
    ctx.variables
  );
  const method = (node.inputs.find((i) => i.key === NodeInputKeyEnum.httpMethod)?.value || "GET").toUpperCase();
  const headersInput = node.inputs.find((i) => i.key === NodeInputKeyEnum.httpHeaders)?.value || [];
  const body = node.inputs.find((i) => i.key === NodeInputKeyEnum.httpJsonBody)?.value;
  const timeout = node.inputs.find((i) => i.key === NodeInputKeyEnum.httpTimeout)?.value || 30;

  const headers: Record<string, string> = {};
  for (const h of headersInput) {
    if (h.key && h.value) headers[replaceVariables(h.key, ctx.variables)] = replaceVariables(h.value, ctx.variables);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout * 1000);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method !== "GET" && body ? replaceVariables(typeof body === "string" ? body : JSON.stringify(body), ctx.variables) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = text; }
    return {
      output: { [NodeOutputKeyEnum.httpResult]: json },
      responseData: { statusCode: res.status, url, method },
    };
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`HTTP request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function dispatchCode(
  node: WorkflowNodeItemType,
  ctx: DispatchContext
): Promise<NodeDispatchResult> {
  const code = node.inputs.find((i) => i.key === NodeInputKeyEnum.code)?.value || "";
  const codeType = node.inputs.find((i) => i.key === NodeInputKeyEnum.codeType)?.value || "javascript";

  const sandboxUrl = process.env.CODE_SANDBOX_URL;
  if (!sandboxUrl) throw new Error("CODE_SANDBOX_URL is not configured");

  const res = await fetch(`${sandboxUrl}/sandbox/js`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      variables: ctx.variables,
    }),
  });

  if (!res.ok) throw new Error(`Code execution failed: ${res.status}`);
  const result = await res.json();
  return { output: { [NodeOutputKeyEnum.codeResult]: result.result } };
}

function dispatchVariableUpdate(
  node: WorkflowNodeItemType,
  ctx: DispatchContext
): NodeDispatchResult {
  const updateList = node.inputs.find((i) => i.key === NodeInputKeyEnum.variableUpdateList)?.value || [];

  for (const item of updateList) {
    const varPath = item.variable || [];
    const value = item.value;
    if (varPath.length === 0) continue;

    let current: any = ctx.variables;
    for (let i = 0; i < varPath.length - 1; i++) {
      if (!current[varPath[i]]) current[varPath[i]] = {};
      current = current[varPath[i]];
    }
    current[varPath[varPath.length - 1]] = value;
  }

  return { output: {} };
}

function dispatchTextEditor(
  node: WorkflowNodeItemType,
  ctx: DispatchContext
): NodeDispatchResult {
  const template = node.inputs.find((i) => i.key === NodeInputKeyEnum.textEditorTemplate)?.value || "";
  const inputList = node.inputs.find((i) => i.key === NodeInputKeyEnum.textEditorInputList)?.value || [];

  let result = template;
  for (const item of inputList) {
    const key = item.key || "";
    const value = replaceVariables(String(item.value || ""), ctx.variables);
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return { output: { [NodeOutputKeyEnum.textEditorResult]: result } };
}

function dispatchWorkflowStart(): NodeDispatchResult {
  return { output: {} };
}

function evaluateCondition(a: string, condition: string, b: string): boolean {
  switch (condition) {
    case "eq": return a === b;
    case "neq": return a !== b;
    case "gt": return Number(a) > Number(b);
    case "gte": return Number(a) >= Number(b);
    case "lt": return Number(a) < Number(b);
    case "lte": return Number(a) <= Number(b);
    case "contains": return a.includes(b);
    case "not_contains": return !a.includes(b);
    case "empty": return !a || a.trim() === "";
    case "notEmpty": return !!a && a.trim() !== "";
    default: return false;
  }
}

function replaceVariables(text: string, variables: Record<string, any>): string {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const keys = path.trim().split(".");
    const value = getVariableValue(variables, keys);
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

function findNextNodes(
  currentNodeId: string,
  edges: WorkflowEdgeItemType[],
  skipHandleId?: string
): string[] {
  let relevantEdges = edges.filter((e) => e.source === currentNodeId);
  if (skipHandleId) {
    relevantEdges = relevantEdges.filter((e) => e.sourceHandle === skipHandleId);
  }
  return [...new Set(relevantEdges.map((e) => e.target))];
}

const dispatchMap: Record<string, (node: WorkflowNodeItemType, ctx: DispatchContext) => any> = {
  [FlowNodeTypeEnum.workflowStart]: dispatchWorkflowStart,
  [FlowNodeTypeEnum.chatNode]: dispatchChatNode,
  [FlowNodeTypeEnum.datasetSearchNode]: dispatchDatasetSearch,
  [FlowNodeTypeEnum.answerNode]: dispatchAnswer,
  [FlowNodeTypeEnum.ifElseNode]: dispatchIfElse,
  [FlowNodeTypeEnum.httpRequest468]: dispatchHttpRequest,
  [FlowNodeTypeEnum.code]: dispatchCode,
  [FlowNodeTypeEnum.variableUpdate]: dispatchVariableUpdate,
  [FlowNodeTypeEnum.textEditor]: dispatchTextEditor,
};

export async function runWorkflow(ctx: DispatchContext): Promise<{
  outputText: string;
  nodeResponses: Array<{ nodeId: string; nodeType: string; output: Record<string, any>; responseData?: Record<string, any> }>;
  variables: Record<string, any>;
}> {
  const nodeResponses: Array<{ nodeId: string; nodeType: string; output: Record<string, any>; responseData?: Record<string, any> }> = [];
  const visited = new Set<string>();
  const queue: string[] = [];

  const startNode = ctx.runtimeNodes.find((n) => n.flowNodeType === FlowNodeTypeEnum.workflowStart);
  if (startNode) queue.push(startNode.nodeId);

  let outputText = "";
  let iterations = 0;
  const MAX_ITERATIONS = 500;

  while (queue.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = ctx.runtimeNodes.find((n) => n.nodeId === nodeId);
    if (!node) continue;

    const handler = dispatchMap[node.flowNodeType];
    if (!handler) continue;

    try {
      node.status = "running";
      const result: NodeDispatchResult = await handler(node, ctx);
      node.status = "done";
      node.output = result.output;

      Object.assign(ctx.variables, result.output);

      nodeResponses.push({
        nodeId: node.nodeId,
        nodeType: node.flowNodeType,
        output: result.output,
        responseData: result.responseData,
      });

      if (node.flowNodeType === FlowNodeTypeEnum.answerNode) {
        outputText += (result.output[NodeOutputKeyEnum.answerText] || "") + "\n";
      }

      const nextNodeIds = findNextNodes(nodeId, ctx.runtimeEdges, result[DispatchNodeResponseKeyEnum.skipHandleId]);
      for (const nextId of nextNodeIds) {
        if (!visited.has(nextId)) queue.push(nextId);
      }
    } catch (err) {
      node.status = "error";
      node.error = err instanceof Error ? err.message : String(err);
      nodeResponses.push({
        nodeId: node.nodeId,
        nodeType: node.flowNodeType,
        output: {},
        responseData: { error: node.error },
      });
      break;
    }
  }

  return { outputText: outputText.trim(), nodeResponses, variables: ctx.variables };
}
