import { FlowNodeTypeEnum, DispatchNodeResponseKeyEnum } from "./constants";
import {
  type RuntimeNodeItemType,
  type RuntimeEdgeItemType,
  type NodeDispatchResult,
  type NodeResponseItemType,
  type InteractiveResponseType,
  type NodeEdgeGroupsMap,
  type NodeEdgeGroups,
  type EdgeStatus,
  type WorkflowExecutionLogItem,
  type NodeDebugSnapshot,
} from "./types";
import type { DispatchContext } from "./types";
import { dispatchMap, getNodeRunParams } from "./handlers";
import { classifyEdgesByDFS, findSCCs, isNodeInCycle, getEdgeType } from "./tarjan";
import type { EdgeIndexData } from "./tarjan";

const MAX_RUN_TIMES = 500;
const MAX_CONCURRENCY = 10;
const MAX_LOOP_TIMES = 100;

// ═══════════════════════════════════════════════
// Core WorkflowQueue Class
// ═══════════════════════════════════════════════

export class WorkflowQueue {
  private ctx: DispatchContext;
  private nodesMap: Map<string, RuntimeNodeItemType>;
  private edgeIndex: EdgeIndexData;
  private nodeEdgeGroupsMap: NodeEdgeGroupsMap;

  private activeRunQueue = new Set<string>();
  private skipNodeQueue = new Map<string, { node: RuntimeNodeItemType; skippedNodeIdList: Set<string> }>();
  private processingActive = false;

  private runtimeEdges: RuntimeEdgeItemType[];
  private runtimeNodes: RuntimeNodeItemType[];

  // Results
  chatResponses: NodeResponseItemType[] = [];
  nodeResponses: Record<string, {
    nodeId: string;
    type: "skip" | "run";
    response?: NodeResponseItemType;
    interactiveResponse?: InteractiveResponseType;
  }> = {};
  entryNodeIds: string[] = [];
  skipNodeCache: Array<{ id: string; skippedNodeIdList: string[] }> = [];
  answerText = "";
  assistantTexts: string[] = [];
  dimensionsCount = 0;
  executionLogs: WorkflowExecutionLogItem[] = [];
  nodeSnapshots: NodeDebugSnapshot[] = [];

  interactiveResponse: InteractiveResponseType | undefined;
  debugNextStepNodes: RuntimeNodeItemType[] = [];

  constructor(data: {
    ctx: DispatchContext;
    maxConcurrency?: number;
  }) {
    this.ctx = data.ctx;
    this.runtimeEdges = data.ctx.runtimeEdges;
    this.runtimeNodes = data.ctx.runtimeNodes;
    this.nodesMap = new Map(data.ctx.runtimeNodes.map((n) => [n.nodeId, n]));
    data.ctx.runtimeNodesMap = this.nodesMap;
    data.ctx.maxRunTimes = data.ctx.maxRunTimes ?? MAX_RUN_TIMES;
    data.ctx.nodeOutputMap = data.ctx.nodeOutputMap || new Map();
    data.ctx.executionLogs = this.executionLogs;

    this.edgeIndex = WorkflowQueue.buildEdgeIndex(this.runtimeEdges);

    this.nodeEdgeGroupsMap = WorkflowQueue.buildNodeEdgeGroupsMap({
      nodesMap: this.nodesMap,
      runtimeNodes: this.runtimeNodes,
      edgeIndex: this.edgeIndex,
    });
  }

  // ═══════════ Edge Index ═══════════

  static buildEdgeIndex(edges: RuntimeEdgeItemType[]): EdgeIndexData {
    const index: EdgeIndexData = {
      bySource: new Map(),
      byTarget: new Map(),
    };
    for (const edge of edges) {
      if (!index.bySource.has(edge.source)) index.bySource.set(edge.source, []);
      index.bySource.get(edge.source)!.push(edge);

      if (!index.byTarget.has(edge.target)) index.byTarget.set(edge.target, []);
      index.byTarget.get(edge.target)!.push(edge);
    }
    return index;
  }

  // ═══════════ Node Edge Groups (Tarjan SCC + DFS) ═══════════

  static buildNodeEdgeGroupsMap(input: {
    nodesMap: Map<string, RuntimeNodeItemType>;
    runtimeNodes: RuntimeNodeItemType[];
    edgeIndex: EdgeIndexData;
  }): NodeEdgeGroupsMap {
    const { nodesMap, runtimeNodes, edgeIndex } = input;
    const map = new Map<string, NodeEdgeGroups>();

    const edgeTypes = classifyEdgesByDFS(runtimeNodes, edgeIndex);
    const { nodeToSCC, sccSizes } = findSCCs(runtimeNodes, edgeIndex);

    const isBranchNode = (node: RuntimeNodeItemType) => {
      return node.flowNodeType === FlowNodeTypeEnum.ifElseNode ||
        node.flowNodeType === FlowNodeTypeEnum.classifyQuestion ||
        node.flowNodeType === FlowNodeTypeEnum.userSelect;
    };

    for (const targetNode of runtimeNodes) {
      const sourceEdges = edgeIndex.byTarget.get(targetNode.nodeId) || [];
      const targetInCycle = isNodeInCycle(targetNode.nodeId, nodeToSCC, sccSizes);

      const backEdges: RuntimeEdgeItemType[] = [];
      const nonBackEdges: RuntimeEdgeItemType[] = [];

      for (const edge of sourceEdges) {
        const type = getEdgeType(edge, edgeTypes);
        if (type === "back") backEdges.push(edge);
        else nonBackEdges.push(edge);
      }

      const edgesGroup: NodeEdgeGroups = [];

      if (nonBackEdges.length > 0) {
        if (targetInCycle) {
          const branchGroups = groupEdgesByBranch(nonBackEdges, edgeIndex, nodesMap, isBranchNode);
          edgesGroup.push(...branchGroups);
        } else {
          edgesGroup.push(nonBackEdges);
        }
      }

      if (backEdges.length > 0) {
        const branchGroups = groupEdgesByBranch(backEdges, edgeIndex, nodesMap, isBranchNode);
        edgesGroup.push(...branchGroups);
      }

      map.set(targetNode.nodeId, edgesGroup);
    }

    return map;
  }

  // ═══════════ Node Status ═══════════

  static getNodeRunStatus(node: RuntimeNodeItemType, nodeEdgeGroupsMap: NodeEdgeGroupsMap): "run" | "skip" | "wait" {
    const edgeGroups = nodeEdgeGroupsMap.get(node.nodeId);
    if (!edgeGroups || edgeGroups.length === 0) return "run";

    if (
      edgeGroups.some((group) =>
        group.some((e) => e.status === "active") &&
        group.every((e) => e.status !== "waiting")
      )
    ) {
      return "run";
    }

    if (edgeGroups.every((group) => group.every((e) => e.status === "skipped"))) {
      return "skip";
    }

    return "wait";
  }

  // ═══════════ Queue Lifecycle ═══════════

  addActiveNode(nodeId: string) {
    if (this.activeRunQueue.has(nodeId)) return;
    this.activeRunQueue.add(nodeId);
    const node = this.nodesMap.get(nodeId);
    this.pushExecutionLog(node, "queued");
  }

  addSkipNode(node: RuntimeNodeItemType, skippedNodeIdList: Set<string>) {
    const existing = this.skipNodeQueue.get(node.nodeId);
    const merged = new Set([...skippedNodeIdList, ...(existing?.skippedNodeIdList || [])]);
    this.skipNodeQueue.set(node.nodeId, { node, skippedNodeIdList: merged });
    this.pushExecutionLog(node, "skip", "节点进入跳过队列");
  }

  private async startProcessing() {
    if (this.processingActive) return;
    this.processingActive = true;

    try {
      const runningPromises = new Set<Promise<unknown>>();

      while (true) {
        if (this.activeRunQueue.size === 0 && runningPromises.size === 0) {
          if (this.skipNodeQueue.size > 0 && !this.interactiveResponse) {
            await this.processSkipNodes();
            continue;
          }
          break;
        }

        if (this.activeRunQueue.size === 0 || runningPromises.size >= MAX_CONCURRENCY) {
          if (runningPromises.size > 0) {
            await Promise.race(runningPromises);
          }
          continue;
        }

        const nodeId = this.activeRunQueue.keys().next().value as string;
        this.activeRunQueue.delete(nodeId);

        const node = this.nodesMap.get(nodeId);
        if (!node) continue;

        const promise = this.checkNodeCanRun(node).finally(() => {
          runningPromises.delete(promise);
        });
        runningPromises.add(promise);
      }
    } finally {
      this.processingActive = false;
    }
  }

  private async processSkipNodes() {
    await new Promise((r) => setImmediate(r));
    const skipItem = this.skipNodeQueue.values().next().value;
    if (skipItem) {
      this.skipNodeQueue.delete(skipItem.node.nodeId);
      await this.checkNodeCanRun(skipItem.node, skipItem.skippedNodeIdList);
    }
  }

  // ═══════════ Node Execution ═══════════

  private async checkNodeCanRun(node: RuntimeNodeItemType, skippedNodeIdList = new Set<string>()) {
    if (this.ctx.maxRunTimes! <= 0) return;

    const status = WorkflowQueue.getNodeRunStatus(node, this.nodeEdgeGroupsMap);
    if (status === "wait") {
      this.pushExecutionLog(node, "wait", "等待前序节点完成");
    }

    let runResult: {
      node: RuntimeNodeItemType;
      status: "run" | "skip";
      result: NodeDispatchResult;
    } | undefined;

    if (status === "run") {
      // Mark all source edges as waiting
      for (const edge of this.runtimeEdges) {
        if (edge.target === node.nodeId) edge.status = "waiting";
      }

      // Execute node
      this.pushExecutionLog(node, "run", "开始执行节点");
      const result = await this.nodeRunWithActive(node);
      runResult = { node, status: "run", result };
    } else if (status === "skip" && !skippedNodeIdList.has(node.nodeId)) {
      // Mark all source edges as waiting
      for (const edge of this.runtimeEdges) {
        if (edge.target === node.nodeId) edge.status = "waiting";
      }
      this.ctx.maxRunTimes!--;

      skippedNodeIdList.add(node.nodeId);
      const result = this.nodeRunWithSkip(node);
      runResult = { node, status: "skip", result };
    }

    if (!runResult) return;

    const result = runResult.result;

    // Store debug data
    if (this.ctx.mode === "debug") {
      this.nodeResponses[node.nodeId] = {
        nodeId: node.nodeId,
        type: runResult.status,
        response: result.nodeResponse,
        interactiveResponse: result.interactive,
      };
    }

    // Remove from skip queue if it ran
    if (runResult.status === "run") {
      this.skipNodeQueue.delete(node.nodeId);
    }

    // If has skip edges, add to skipped list
    const skipEdges = result.skipHandleId || [];
    if (skipEdges.length > 0) {
      skippedNodeIdList.add(node.nodeId);
    }

    // Update edges and get next nodes
    const { nextActiveNodes, nextSkipNodes } = this.nodeOutput(runResult.node, result);

    // Add skip nodes to queue
    for (const nextNode of nextSkipNodes) {
      this.addSkipNode(nextNode, skippedNodeIdList);
    }

    // Handle interactive response
    if (result.interactive) {
      this.interactiveResponse = result.interactive;
      this.pushExecutionLog(node, "interactive", "节点等待交互输入", {
        interactiveType: result.interactive.type,
      });
      if (this.ctx.mode === "debug") {
        this.debugNextStepNodes = this.debugNextStepNodes.concat([runResult.node]);
      }
      return;
    }

    // Add active nodes to queue
    for (const nextNode of nextActiveNodes) {
      this.addActiveNode(nextNode.nodeId);
    }
  }

  private async nodeRunWithActive(node: RuntimeNodeItemType): Promise<NodeDispatchResult> {
    const handler = dispatchMap[node.flowNodeType];
    if (!handler) {
      return { data: {}, nodeResponse: { nodeId: node.nodeId, moduleName: node.name, moduleType: node.flowNodeType } };
    }

    const startTime = Date.now();
    const resolvedInputs = this.ctx.mode === "debug"
      ? getNodeRunParams(this.ctx as any, node, this.ctx.variables, this.nodesMap)
      : {};

    try {
      const result = await handler({
        ctx: this.ctx,
        node,
        nodeOutput: (n: RuntimeNodeItemType) => {},
      });

      // Post-process outputs
      for (const output of node.outputs) {
        if (output.required && result.data && result.data[output.key] === undefined) {
          result.data![output.key] = output.defaultValue ?? valueTypeFormat("", output.valueType);
        }
      }

      const nodeResponse: NodeResponseItemType = {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
        runningTime: +((Date.now() - startTime) / 1000).toFixed(2),
        ...result.nodeResponse,
      };

      if (this.ctx.mode === "debug") {
        const snapshotInputs = { ...resolvedInputs };

        // For chat-related nodes, include the resolved history messages in the snapshot
        // so users can verify that conversation history is being passed correctly.
        const chatNodeTypes = [
          FlowNodeTypeEnum.chatNode,
          FlowNodeTypeEnum.agent,
          FlowNodeTypeEnum.classifyQuestion,
          FlowNodeTypeEnum.contentExtract,
        ];
        if (chatNodeTypes.includes(node.flowNodeType as FlowNodeTypeEnum)) {
          const historyRounds = typeof snapshotInputs.history === "number" ? snapshotInputs.history : 3;
          const messageCount = historyRounds * 2; // Each round = 1 Human + 1 AI message
          const histLen = this.ctx.histories.length;
          const resolvedHistories = this.ctx.histories.slice(-Math.min(messageCount, histLen));
          if (resolvedHistories.length > 0) {
            snapshotInputs["_resolvedHistories"] = resolvedHistories;
          } else {
            snapshotInputs["_resolvedHistories"] = [];
          }
        }

        this.nodeSnapshots.push({
          nodeId: node.nodeId,
          nodeName: node.name,
          nodeType: node.flowNodeType,
          status: "run",
          resolvedInputs: snapshotInputs,
          outputs: result.data || {},
          runningTime: nodeResponse.runningTime,
          timestamp: new Date().toISOString(),
          llmRequest: nodeResponse.llmRequest,
        });
      }

      return { ...result, nodeResponse };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.pushExecutionLog(node, "error", errorMsg);

      if (this.ctx.mode === "debug") {
        this.nodeSnapshots.push({
          nodeId: node.nodeId,
          nodeName: node.name,
          nodeType: node.flowNodeType,
          status: "error",
          resolvedInputs: resolvedInputs || {},
          outputs: {},
          runningTime: +((Date.now() - startTime) / 1000).toFixed(2),
          error: errorMsg,
          timestamp: new Date().toISOString(),
        });
      }

      const targetEdges = this.edgeIndex.bySource.get(node.nodeId) || [];
      const errorHandleId = `${node.nodeId}-source_catch-right`;
      let skipHandleIds: string[];

      if (node.catchError) {
        // Node has error catching - skip non-error edges
        skipHandleIds = targetEdges
          .filter((e) => e.sourceHandle !== errorHandleId)
          .map((e) => e.sourceHandle || "");
      } else {
        // No error catching - skip all edges
        skipHandleIds = targetEdges.map((e) => e.sourceHandle || "");
      }

      return {
        data: {},
        skipHandleId: skipHandleIds.filter(Boolean),
        nodeResponse: {
          nodeId: node.nodeId,
          moduleName: node.name,
          moduleType: node.flowNodeType,
          runningTime: +((Date.now() - startTime) / 1000).toFixed(2),
          error: errorMsg,
        },
      };
    }
  }

  private nodeRunWithSkip(node: RuntimeNodeItemType): NodeDispatchResult {
    const targetEdges = this.edgeIndex.bySource.get(node.nodeId) || [];
    return {
      data: {},
      skipHandleId: targetEdges.map((e) => e.sourceHandle || ""),
      nodeResponse: {
        nodeId: node.nodeId,
        moduleName: node.name,
        moduleType: node.flowNodeType,
      },
    };
  }

  // ═══════════ Output Propagation ═══════════

  private nodeOutput(
    node: RuntimeNodeItemType,
    result: NodeDispatchResult
  ): {
    nextActiveNodes: RuntimeNodeItemType[];
    nextSkipNodes: RuntimeNodeItemType[];
  } {
    // Update node outputs
    const concatData = { ...(result.data || {}) };
    const nodeOutputMap = this.ctx.nodeOutputMap!;
    for (const output of node.outputs) {
      if (concatData[output.key] !== undefined) {
        output.value = concatData[output.key];
      }
    }
    nodeOutputMap.set(node.nodeId, {
      ...(nodeOutputMap.get(node.nodeId) || {}),
      ...Object.fromEntries((node.outputs || []).map((output) => [output.key, output.value])),
      ...concatData,
    });

    // Propagate outputs to variables
    if (concatData) {
      Object.assign(this.ctx.variables, concatData);
    }

    // Collect answer texts
    if (result.answerText) {
      this.answerText += result.answerText + "\n";
      this.assistantTexts.push(result.answerText);
    }

    // Store node response
    this.chatResponses.push(result.nodeResponse || {
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
    });

    // Update edge status
    const skipHandleId = result.skipHandleId || [];
    const targetEdges = this.edgeIndex.bySource.get(node.nodeId) || [];

    for (const edge of targetEdges) {
      const normalizedHandleId = edge.sourceHandle || "";
      const normalizedSkipHandles = skipHandleId.map((h) => {
        const parts = h.split("-");
        const last = parts.pop() || "";
        const secondLast = parts.pop() || "";
        return `${secondLast}-${last}`;
      });

      if (
        skipHandleId.includes(normalizedHandleId) ||
        normalizedSkipHandles.includes(normalizedHandleId)
      ) {
        edge.status = "skipped";
      } else {
        edge.status = "active";
      }
    }

    // Collect next nodes
    const nextActiveNodesMap = new Map<string, RuntimeNodeItemType>();
    const nextSkipNodesMap = new Map<string, RuntimeNodeItemType>();

    for (const edge of targetEdges) {
      const targetNode = this.nodesMap.get(edge.target);
      if (!targetNode) continue;

      if (edge.status === "active") {
        nextActiveNodesMap.set(targetNode.nodeId, targetNode);
      } else if (edge.status === "skipped") {
        nextSkipNodesMap.set(targetNode.nodeId, targetNode);
      }
    }

    return {
      nextActiveNodes: Array.from(nextActiveNodesMap.values()),
      nextSkipNodes: Array.from(nextSkipNodesMap.values()),
    };
  }

  // ═══════════ Public Run ═══════════

  async run(): Promise<WorkflowResultData> {
    return new Promise<WorkflowResultData>((resolve) => {
      // Find entry nodes
      const entryNodes = this.runtimeNodes.filter((n) => {
        const inEdges = this.edgeIndex.byTarget.get(n.nodeId) || [];
        return inEdges.length === 0;
      });

      if (entryNodes.length === 0) {
        // If no obvious entry, start from workflowStart
        const startNode = this.runtimeNodes.find(
          (n) => n.flowNodeType === FlowNodeTypeEnum.workflowStart
        );
        if (startNode) {
          this.addActiveNode(startNode.nodeId);
        }
      } else {
        for (const node of entryNodes) {
          this.addActiveNode(node.nodeId);
        }
      }

      void this.startProcessing().then(() => {
        resolve(this.getResult());
      });
    });
  }

  getResult(): WorkflowResultData {
    const entryNodeIds = this.debugNextStepNodes.map((n) => n.nodeId);

    return {
      outputText: this.answerText.trim(),
      nodeResponses: this.chatResponses,
      variables: this.ctx.variables,
      memoryNodes: this.runtimeNodes.map((n) => ({
        ...n,
        outputs: n.outputs.map((o) => ({ ...o })),
      })),
      memoryEdges: this.runtimeEdges.map((e) => ({
        ...e,
        status: entryNodeIds.includes(e.target) ? "active" : e.status,
      })),
      entryNodeIds,
      debugNodeResponses: this.nodeResponses,
      skipNodeQueue: Array.from(this.skipNodeQueue.values()).map((item) => ({
        id: item.node.nodeId,
        skippedNodeIdList: Array.from(item.skippedNodeIdList),
      })),
      interactiveResponse: this.interactiveResponse,
      executionLogs: this.executionLogs,
      nodeSnapshots: this.nodeSnapshots,
    };
  }

  private pushExecutionLog(
    node: RuntimeNodeItemType | undefined,
    status: WorkflowExecutionLogItem["status"],
    message?: string,
    detail?: Record<string, any>
  ) {
    if (!node) return;
    this.executionLogs.push({
      nodeId: node.nodeId,
      moduleName: node.name,
      moduleType: node.flowNodeType,
      status,
      message,
      detail,
      timestamp: new Date().toISOString(),
    });
  }
}

// ═══════════ Helper Functions ═══════════

function groupEdgesByBranch(
  edges: RuntimeEdgeItemType[],
  edgeIndex: EdgeIndexData,
  nodesMap: Map<string, RuntimeNodeItemType>,
  isBranchNode: (node: RuntimeNodeItemType) => boolean
): RuntimeEdgeItemType[][] {
  const edgeBranchMap = new Map<RuntimeEdgeItemType, string>();

  for (const edge of edges) {
    const branchHandle = findBranchHandle(edge, edgeIndex, nodesMap, isBranchNode);
    edgeBranchMap.set(edge, branchHandle);
  }

  const groups = new Map<string, RuntimeEdgeItemType[]>();
  for (const edge of edges) {
    const handle = edgeBranchMap.get(edge)!;
    if (!groups.has(handle)) groups.set(handle, []);
    groups.get(handle)!.push(edge);
  }

  return Array.from(groups.values());
}

function findBranchHandle(
  edge: RuntimeEdgeItemType,
  edgeIndex: EdgeIndexData,
  nodesMap: Map<string, RuntimeNodeItemType>,
  isBranchNode: (node: RuntimeNodeItemType) => boolean
): string {
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; handle?: string }> = [
    { nodeId: edge.source, handle: edge.sourceHandle },
  ];

  while (queue.length > 0) {
    const { nodeId, handle } = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodesMap.get(nodeId);
    if (!node) continue;

    if (isBranchNode(node) && handle) return handle;

    const inEdges = edgeIndex.byTarget.get(nodeId) || [];
    for (const inEdge of inEdges) {
      const sourceNode = nodesMap.get(inEdge.source);
      if (!sourceNode) continue;
      const newHandle = isBranchNode(sourceNode) ? inEdge.sourceHandle : handle;
      queue.push({ nodeId: inEdge.source, handle: newHandle });
    }
  }

  return "common";
}

function valueTypeFormat(val: any, vt?: string): any {
  if (val === undefined || val === null) return val;
  if (!vt) return val;
  if (vt === "string") return String(val);
  if (vt === "number") return Number(val);
  if (vt === "boolean") return Boolean(val);
  return val;
}

// ═══════════ Result Types & Public API ═══════════

export interface WorkflowResultData {
  outputText: string;
  nodeResponses: NodeResponseItemType[];
  variables: Record<string, any>;
  memoryNodes: RuntimeNodeItemType[];
  memoryEdges: RuntimeEdgeItemType[];
  entryNodeIds: string[];
  debugNodeResponses: Record<string, {
    nodeId: string;
    type: "skip" | "run";
    response?: NodeResponseItemType;
    interactiveResponse?: InteractiveResponseType;
  }>;
  skipNodeQueue: Array<{ id: string; skippedNodeIdList: string[] }>;
  interactiveResponse?: InteractiveResponseType;
  executionLogs: WorkflowExecutionLogItem[];
  nodeSnapshots: NodeDebugSnapshot[];
}

export { type DispatchContext } from "./types";

export async function runWorkflow(ctx: DispatchContext): Promise<WorkflowResultData> {
  const queue = new WorkflowQueue({ ctx });
  await queue.run();
  return queue.getResult();
}
