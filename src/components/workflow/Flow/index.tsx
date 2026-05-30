"use client";

import { useCallback, useMemo, useRef, useEffect, useState, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Node,
  type Edge,
  type OnInit,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeProps,
  Handle,
  MarkerType,
  Position,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeConfigModal, type DatasetOption, type LlmModelOption } from "./NodeConfigModal";
import {
  createWorkflowNodeModule,
  getNodeConnectableInputs,
  getNodeConnectableOutputs,
  normalizeWorkflowNode,
} from "@/lib/workflow/schema";

const START_NODE_ID = "workflowStart";
const START_NODE_POSITION = { x: 100, y: 200 };

const NODE_TEMPLATES = [
  { type: "chatNode", label: "AI 对话", icon: "🤖", desc: "调用大模型生成回答", category: "ai" },
  { type: "datasetSearchNode", label: "知识库搜索", icon: "📚", desc: "检索知识库内容供后续引用", category: "ai" },
  { type: "ifElseNode", label: "条件分支", icon: "🔀", desc: "按条件命中不同分支", category: "logic" },
  { type: "httpRequest468", label: "HTTP 请求", icon: "🌐", desc: "调用外部接口获取数据", category: "tools" },
  { type: "formInput", label: "表单输入", icon: "📋", desc: "收集用户填写的信息", category: "interact" },
  { type: "userSelect", label: "用户选择", icon: "👆", desc: "让用户主动选择路径", category: "interact" },
  { type: "answerNode", label: "指定回复", icon: "💬", desc: "直接输出固定回复内容", category: "output" },
];

type NodeActionHandlers = {
  active?: boolean;
  editable?: boolean;
  deletable?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

function getNodeTemplate(type?: string) {
  return NODE_TEMPLATES.find((item) => item.type === type);
}

function supportsConfigModal(type?: string) {
  return !!getNodeTemplate(type);
}

function getModuleFromData(data: Record<string, any>) {
  return normalizeWorkflowNode(data._module || {});
}

function buildCanvasDataFromModule(module: Record<string, any>) {
  const normalized = normalizeWorkflowNode(module as any);
  const inputValues = Object.fromEntries((normalized.inputs || []).map((input: any) => [input.key, input.value]));

  return {
    ...inputValues,
    label: normalized.name,
    model: normalized.inputs?.find((input: any) => input.key === "model")?.value,
    modelName: normalized.inputs?.find((input: any) => input.key === "modelName")?.value,
    systemPrompt: normalized.inputs?.find((input: any) => input.key === "system_chat_prompt")?.value,
    answerText: normalized.inputs?.find((input: any) => input.key === "answerText")?.value,
    url: normalized.inputs?.find((input: any) => input.key === "system_httpReqUrl")?.value,
    method: normalized.inputs?.find((input: any) => input.key === "system_httpMethod")?.value,
    ifElseList: normalized.inputs?.find((input: any) => input.key === "ifElseList")?.value,
    datasets: normalized.inputs?.find((input: any) => input.key === "datasets")?.value,
    description: normalized.inputs?.find((input: any) => input.key === "description")?.value,
    userInputForms: normalized.inputs?.find((input: any) => input.key === "userInputForms")?.value,
    userSelectOptions: normalized.inputs?.find((input: any) => input.key === "userSelectOptions")?.value,
    _module: normalized,
  };
}

function renderTargetHandles(data: Record<string, any>, color: string) {
  const inputs = getNodeConnectableInputs(getModuleFromData(data));
  if (inputs.length === 0) return null;

  return inputs.map((input, index) => (
    <Handle
      key={`target-${input.key}`}
      type="target"
      id={input.key}
      position={Position.Left}
      style={{ top: 36 + index * 18, background: color }}
    />
  ));
}

function renderSourceHandles(data: Record<string, any>, color: string) {
  const outputs = getNodeConnectableOutputs(getModuleFromData(data));
  if (outputs.length === 0) return null;

  return outputs.map((output, index) => (
    <Handle
      key={`source-${output.key}`}
      type="source"
      id={output.key}
      position={Position.Right}
      style={{ top: 36 + index * 18, background: color }}
    />
  ));
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
      <path d="M3.5 11.5 3 13l1.5-.5L11.8 5.2 10.3 3.7 3.5 11.5Z" />
      <path d="m9.9 4.1 1.5 1.5" />
      <path d="M3 13h10" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-4 w-4">
      <path d="M3.5 4.5h9" />
      <path d="M6.5 2.8h3" />
      <path d="M5 4.5v7a1.5 1.5 0 0 0 1.5 1.5h3A1.5 1.5 0 0 0 11 11.5v-7" />
      <path d="M6.8 6.5v4" />
      <path d="M9.2 6.5v4" />
    </svg>
  );
}

function ToolbarIconButton({
  label,
  tone = "default",
  onClick,
  children,
}: {
  label: string;
  tone?: "default" | "danger";
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600"
      : "bg-blue-50 text-gray-600 hover:bg-blue-100 hover:text-blue-600";

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-8 min-w-[72px] items-center gap-2 rounded-lg px-2.5 text-xs font-medium transition ${toneClass}`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function NodeActionToolbar({ actions }: { actions?: NodeActionHandlers }) {
  if (!actions) return null;

  const showEdit = actions.editable !== false && typeof actions.onEdit === "function";
  const showDelete = actions.deletable !== false && typeof actions.onDelete === "function";

  if (!showEdit && !showDelete) return null;

  return (
    <div
      className={`absolute left-full top-0 z-20 ml-1.5 transition-all duration-150 group-hover/node:pointer-events-auto group-hover/node:opacity-100 group-focus-within/node:pointer-events-auto group-focus-within/node:opacity-100 ${
        actions.active
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
    >
      <div className="flex flex-col gap-0.5">
        {showEdit && (
          <ToolbarIconButton
            label="编辑"
            onClick={(e) => {
              e.stopPropagation();
              actions.onEdit?.();
            }}
          >
            <EditIcon />
          </ToolbarIconButton>
        )}
        {showDelete && (
          <ToolbarIconButton
            label="删除"
            tone="danger"
            onClick={(e) => {
              e.stopPropagation();
              actions.onDelete?.();
            }}
          >
            <DeleteIcon />
          </ToolbarIconButton>
        )}
      </div>
    </div>
  );
}

function NodeShell({
  data,
  className,
  children,
}: {
  data: Record<string, any>;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className="group/node relative overflow-visible">
      <div className={className}>{children}</div>
      <NodeActionToolbar actions={data._actions} />
    </div>
  );
}

function StartNode({ data }: NodeProps) {
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-green-400 bg-green-50 px-4 py-3 shadow-sm">
      <div className="text-sm font-semibold text-green-700">开始</div>
      <div className="mt-1 text-xs text-green-500">{String(data.label || "用户输入")}</div>
      {renderSourceHandles(data, "#22c55e")}
    </NodeShell>
  );
}

function ChatNodeComponent({ data }: NodeProps) {
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-blue-400 bg-white px-4 py-3 shadow-sm">
      {renderTargetHandles(data, "#3b82f6")}
      <div className="flex items-center gap-2">
        <span>🤖</span>
        <span className="text-sm font-semibold text-gray-800">AI 对话</span>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        模型: {String(data.modelName || data.model || "默认")}
      </div>
      {renderSourceHandles(data, "#3b82f6")}
    </NodeShell>
  );
}

function DatasetSearchNodeComponent({ data }: NodeProps) {
  const selectedDatasets = Array.isArray(data.datasets) ? data.datasets : [];
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-yellow-400 bg-white px-4 py-3 shadow-sm">
      {renderTargetHandles(data, "#eab308")}
      <div className="flex items-center gap-2">
        <span>📚</span>
        <span className="text-sm font-semibold text-gray-800">知识库搜索</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {selectedDatasets.length > 0 ? `已配置 ${selectedDatasets.length} 个知识库` : "未配置知识库"}
      </div>
      {renderSourceHandles(data, "#eab308")}
    </NodeShell>
  );
}

function AnswerNodeComponent({ data }: NodeProps) {
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-purple-400 bg-white px-4 py-3 shadow-sm">
      {renderTargetHandles(data, "#a855f7")}
      <div className="flex items-center gap-2">
        <span>💬</span>
        <span className="text-sm font-semibold text-gray-800">指定回复</span>
      </div>
      <div className="mt-1 line-clamp-3 text-xs text-gray-500">
        {String(data.answerText || "输出回答内容")}
      </div>
      {renderSourceHandles(data, "#a855f7")}
    </NodeShell>
  );
}

function IfElseNodeComponent({ data }: NodeProps) {
  const conditions = (data.ifElseList || []) as any[];
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-orange-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>🔀</span>
        <span className="text-sm font-semibold text-gray-800">条件分支</span>
      </div>
      {conditions.map((_: any, i: number) => (
        <Handle key={`if-${i}`} type="source" position={Position.Right} id={`ifElse-result-${i}`} style={{ top: 30 + i * 16 }} className="!bg-orange-400" />
      ))}
      <Handle type="source" position={Position.Right} id="ifElse-else" style={{ top: 30 + conditions.length * 16 }} className="!bg-gray-400" />
    </NodeShell>
  );
}

function HttpNodeComponent({ data }: NodeProps) {
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-cyan-400 bg-white px-4 py-3 shadow-sm">
      {renderTargetHandles(data, "#06b6d4")}
      <div className="flex items-center gap-2">
        <span>🌐</span>
        <span className="text-sm font-semibold text-gray-800">HTTP 请求</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">{String(data.method || "GET")} {String(data.url || "未设置")}</div>
      {renderSourceHandles(data, "#06b6d4")}
    </NodeShell>
  );
}

function CodeNodeComponent({ data }: NodeProps) {
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-gray-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>⚡</span>
        <span className="text-sm font-semibold text-gray-800">代码执行</span>
      </div>
      <div className="mt-1 line-clamp-2 text-xs font-mono text-gray-400">
        {String(data.code || "// 代码")}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-gray-500" />
    </NodeShell>
  );
}

function VariableUpdateNodeComponent(_: NodeProps) {
  return (
    <NodeShell data={_.data} className="rounded-lg border-2 border-pink-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>📝</span>
        <span className="text-sm font-semibold text-gray-800">变量更新</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-pink-500" />
    </NodeShell>
  );
}

function ClassifyQuestionNodeComponent({ data }: NodeProps) {
  const agents = (data.agents || []) as any[];
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-teal-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>🏷️</span>
        <span className="text-sm font-semibold text-gray-800">问题分类</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        类别: {agents.length > 0 ? agents.map((a: any) => a.key).join(", ") : "未设置"}
      </div>
      {agents.map((_: any, i: number) => (
        <Handle key={`cq-${i}`} type="source" position={Position.Right} id={`${nodeIdForHandle(data)}-source-${_?.key || i}`} style={{ top: 30 + i * 16 }} className="!bg-teal-400" />
      ))}
    </NodeShell>
  );
}

function ContentExtractNodeComponent({ data }: NodeProps) {
  const fields = (data.extractFields || []) as any[];
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-lime-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>📋</span>
        <span className="text-sm font-semibold text-gray-800">内容提取</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        字段: {fields.length > 0 ? fields.map((f: any) => f.key).join(", ") : "未设置"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-lime-500" />
    </NodeShell>
  );
}

function AgentNodeComponent({ data }: NodeProps) {
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-indigo-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>🧠</span>
        <span className="text-sm font-semibold text-gray-800">Agent</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        模型: {String(data.model || "默认")}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-indigo-500" />
    </NodeShell>
  );
}

function TextEditorNodeComponent({ data }: NodeProps) {
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-emerald-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>✏️</span>
        <span className="text-sm font-semibold text-gray-800">文本编辑</span>
      </div>
      <div className="mt-1 line-clamp-1 text-xs text-gray-400">
        {String(data.system_textEditorTemplate || "").slice(0, 40) || "模板"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-emerald-500" />
    </NodeShell>
  );
}

function ReadFilesNodeComponent({ data }: NodeProps) {
  const files = (data.readFilesUrlList || []) as string[];
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-amber-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>📄</span>
        <span className="text-sm font-semibold text-gray-800">文件读取</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {files.length > 0 ? `${files.length} 个文件` : "未设置文件"}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-amber-500" />
    </NodeShell>
  );
}

function DatasetConcatNodeComponent(_: NodeProps) {
  return (
    <NodeShell data={_.data} className="rounded-lg border-2 border-rose-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>🔗</span>
        <span className="text-sm font-semibold text-gray-800">知识库合并</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">合并多路知识库搜索结果</div>
      <Handle type="source" position={Position.Right} className="!bg-rose-500" />
    </NodeShell>
  );
}

function FormInputNodeComponent({ data }: NodeProps) {
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-violet-400 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span>📋</span>
        <span className="text-sm font-semibold text-gray-800">表单输入</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">等待用户填写表单</div>
      {renderSourceHandles(data, "#8b5cf6")}
    </NodeShell>
  );
}

function UserSelectNodeComponent({ data }: NodeProps) {
  const options = (data.userSelectOptions || []) as any[];
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-fuchsia-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>👆</span>
        <span className="text-sm font-semibold text-gray-800">用户选择</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        选项: {options.length > 0 ? options.map((o: any) => o.value).join(", ") : "未设置"}
      </div>
      {options.map((_: any, i: number) => (
        <Handle key={`us-${i}`} type="source" position={Position.Right} id={`${nodeIdForHandle(data)}-source-${_?.key || i}`} style={{ top: 30 + i * 16 }} className="!bg-fuchsia-400" />
      ))}
    </NodeShell>
  );
}

function CustomFeedbackNodeComponent({ data }: NodeProps) {
  return (
    <NodeShell data={data} className="rounded-lg border-2 border-sky-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>💬</span>
        <span className="text-sm font-semibold text-gray-800">自定义反馈</span>
      </div>
      <div className="mt-1 line-clamp-1 text-xs text-gray-400">
        {String(data.feedbackText || "反馈文本").slice(0, 40)}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-sky-500" />
    </NodeShell>
  );
}

function nodeIdForHandle(data: Record<string, any>): string {
  return data._module?.nodeId || "";
}

const nodeTypes = {
  workflowStart: StartNode,
  chatNode: ChatNodeComponent,
  datasetSearchNode: DatasetSearchNodeComponent,
  answerNode: AnswerNodeComponent,
  ifElseNode: IfElseNodeComponent,
  httpRequest468: HttpNodeComponent,
  code: CodeNodeComponent,
  variableUpdate: VariableUpdateNodeComponent,
  classifyQuestion: ClassifyQuestionNodeComponent,
  contentExtract: ContentExtractNodeComponent,
  agent: AgentNodeComponent,
  textEditor: TextEditorNodeComponent,
  readFiles: ReadFilesNodeComponent,
  datasetConcatNode: DatasetConcatNodeComponent,
  formInput: FormInputNodeComponent,
  userSelect: UserSelectNodeComponent,
  customFeedback: CustomFeedbackNodeComponent,
};

type CanvasNode = Node<Record<string, any>>;

function createStartModule() {
  const module = createWorkflowNodeModule("workflowStart", START_NODE_POSITION);
  return {
    ...module,
    nodeId: START_NODE_ID,
  };
}

function ensureStartModule(modules: any[]): any[] {
  const safeModules = Array.isArray(modules) ? modules.map((module) => normalizeWorkflowNode(module)) : [];
  if (safeModules.some((module) => module?.flowNodeType === "workflowStart")) {
    return safeModules;
  }
  return [createStartModule(), ...safeModules];
}

function toWorkflowModules(nodes: CanvasNode[]): any[];
function toWorkflowModules(currentModules: any[], newNode: CanvasNode): any[];
function toWorkflowModules(nodesOrModules: CanvasNode[] | any[], newNode?: CanvasNode): any[] {
  if (newNode) {
    const currentModules = nodesOrModules as any[];
    const baseModule = createWorkflowNodeModule(String(newNode.type || "chatNode"), newNode.position);
    const module = normalizeWorkflowNode({
      ...baseModule,
      nodeId: newNode.id,
      name: String(newNode.data?.label || baseModule.name || newNode.type || "未命名节点"),
      position: newNode.position,
    });
    return ensureStartModule([...currentModules, module]);
  }

  const nodes = nodesOrModules as CanvasNode[];
  const modules = nodes.map((node) => {
    const data = (node.data || {}) as Record<string, any>;
    const previousModule = normalizeWorkflowNode(data._module || {});
    const inputs = (previousModule.inputs || []).map((input: any) => {
      let value = data[input.key];

      if (value === undefined && input.key === "system_chat_prompt") value = data.systemPrompt;
      if (value === undefined && input.key === "system_httpReqUrl") value = data.url;
      if (value === undefined && input.key === "system_httpMethod") value = data.method;

      return {
        ...input,
        value: value !== undefined ? value : input.value,
      };
    });

    return normalizeWorkflowNode({
      ...previousModule,
      nodeId: node.id,
      name: String(data.label || previousModule.name || node.type || "未命名节点"),
      intro: previousModule.intro || "",
      flowNodeType: String(node.type || previousModule.flowNodeType || "chatNode") as any,
      position: node.position,
      inputs,
      outputs: previousModule.outputs || [],
    });
  });

  return ensureStartModule(modules);
}

function toWorkflowEdges(edges: Edge[]): any[] {
  return edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }));
}

function toReactFlowNodes(modules: any[]): CanvasNode[] {
  return ensureStartModule(modules).map((module) => {
    const m = normalizeWorkflowNode(module);
    // 确保节点ID始终存在，避免React Flow初始化错误
    const nodeId = m.nodeId || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
    id: nodeId,
    type: m.flowNodeType || "chatNode",
    position: m.position || { x: 0, y: 0 },
    deletable: m.flowNodeType !== "workflowStart",
    data: buildCanvasDataFromModule(m),
  };
  });
}

function toReactFlowEdges(edges: any[]): Edge[] {
  return (edges || []).map((e, i) => ({
    id: `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    animated: true,
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  }));
}

export function FlowCanvas({
  nodes: moduleNodes,
  edges: moduleEdges,
  onNodesChange,
  onEdgesChange,
  highlightNodeId,
}: {
  nodes: any[];
  edges: any[];
  onNodesChange: (nodes: any[]) => void;
  onEdgesChange: (edges: any[]) => void;
  highlightNodeId?: string | null;
}) {
  const normalizedModuleNodes = useMemo(() => ensureStartModule(moduleNodes), [moduleNodes]);
  const rfNodes = useMemo(() => toReactFlowNodes(normalizedModuleNodes), [normalizedModuleNodes]);
  const rfEdges = useMemo(() => toReactFlowEdges(moduleEdges), [moduleEdges]);
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>(rfNodes);
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>(rfEdges);
  const [editingNode, setEditingNode] = useState<CanvasNode | null>(null);
  const [datasetOptions, setDatasetOptions] = useState<DatasetOption[]>([]);
  const [llmModelOptions, setLlmModelOptions] = useState<LlmModelOption[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const rfInstanceRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const didInitRef = useRef(false);
  const canvasNodesRef = useRef<CanvasNode[]>(rfNodes);
  const canvasEdgesRef = useRef<Edge[]>(rfEdges);
  const isDraggingRef = useRef(false);
  const lastSyncedNodesRef = useRef<CanvasNode[]>(rfNodes);

  useEffect(() => {
    // 避免在拖动过程中重新同步节点，防止覆盖用户操作
    if (isDraggingRef.current) {
      return;
    }
    
    // 只有当节点实际发生变化时才更新
    const hasChanged = rfNodes.length !== lastSyncedNodesRef.current.length ||
      rfNodes.some((node, index) => {
        const lastNode = lastSyncedNodesRef.current[index];
        return !lastNode || node.id !== lastNode.id || 
          node.position.x !== lastNode.position.x || 
          node.position.y !== lastNode.position.y;
      });
    
    if (hasChanged) {
      setCanvasNodes(rfNodes);
      canvasNodesRef.current = rfNodes;
      lastSyncedNodesRef.current = rfNodes;
    }
  }, [rfNodes]);

  useEffect(() => {
    setCanvasEdges(rfEdges);
    canvasEdgesRef.current = rfEdges;
  }, [rfEdges]);

  useEffect(() => {
    let active = true;

    const loadDatasets = async () => {
      setLoadingDatasets(true);
      try {
        const [datasetRes, llmRes] = await Promise.all([
          fetch("/api/knowledge/dataset?pageSize=100"),
          fetch("/api/ai/models?type=LLM"),
        ]);
        if (!datasetRes.ok || !llmRes.ok) return;
        const data = await datasetRes.json();
        const llmData = await llmRes.json();
        if (!active) return;
        setDatasetOptions(
          (data.list || [])
            .filter((item: any) => item.type === "dataset")
            .map((item: any) => ({
              id: String(item.id),
              name: String(item.name),
              embeddingModelId: item.embeddingModelId,
              embeddingModelName: item.embeddingModelName,
              vectorModel: item.vectorModel,
              type: item.type,
            }))
        );
        setLlmModelOptions(
          (llmData.list || []).map((item: any) => ({
            id: String(item.id),
            name: String(item.name),
            model: String(item.model),
          }))
        );
      } finally {
        if (active) {
          setLoadingDatasets(false);
        }
      }
    };

    void loadDatasets();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    if (normalizedModuleNodes.length > 0 && !moduleNodes.some((node) => node?.flowNodeType === "workflowStart")) {
      didInitRef.current = true;
      onNodesChange(normalizedModuleNodes);
    }
    if (normalizedModuleNodes.length > 0 && moduleNodes.some((node) => node?.flowNodeType === "workflowStart")) {
      didInitRef.current = true;
    }
  }, [normalizedModuleNodes, moduleNodes, onNodesChange]);

  const handleInit: OnInit<CanvasNode, Edge> = useCallback((instance) => {
    rfInstanceRef.current = instance;
  }, []);

  const normalizedModulesRef = useRef(normalizedModuleNodes);
  normalizedModulesRef.current = normalizedModuleNodes;
  const moduleEdgesRef = useRef(moduleEdges);
  moduleEdgesRef.current = moduleEdges;

  const onConnect: OnConnect = useCallback(
    (params) => {
      const nextEdges = addEdge(
        {
          ...params,
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        },
        canvasEdgesRef.current
      );
      canvasEdgesRef.current = nextEdges;
      setCanvasEdges(nextEdges);
      onEdgesChange(toWorkflowEdges(nextEdges));
    },
    [onEdgesChange]
  );

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // 检测是否是拖动操作
      const isDragChange = changes.some(
        (change) => change.type === "position" && change.dragging === true
      );
      const isDragEnd = changes.some(
        (change) => change.type === "position" && change.dragging === false
      );
      
      // 设置拖动标志
      if (isDragChange) {
        isDraggingRef.current = true;
      }
      if (isDragEnd) {
        isDraggingRef.current = false;
      }
      
      // 确保使用最新的节点状态，避免引用过时数据
      const currentNodes = canvasNodesRef.current;
      const nextNodes = applyNodeChanges(changes, currentNodes);
      
      // 验证节点数据完整性，确保所有节点都有有效的ID
      const validatedNodes = nextNodes.map((node) => ({
        ...node,
        id: node.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }));
      
      canvasNodesRef.current = validatedNodes;
      setCanvasNodes(validatedNodes);
      lastSyncedNodesRef.current = validatedNodes;
      
      const shouldSync = changes.some(
        (change) => change.type !== "dimensions" && change.type !== "select"
      );
      if (shouldSync) {
        onNodesChange(toWorkflowModules(validatedNodes as CanvasNode[]));
      }
    },
    [onNodesChange]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const nextEdges = applyEdgeChanges(changes, canvasEdgesRef.current);
      canvasEdgesRef.current = nextEdges;
      setCanvasEdges(nextEdges);
      const shouldSync = changes.some((change) => change.type !== "select");
      if (shouldSync) {
        onEdgesChange(toWorkflowEdges(nextEdges));
      }
    },
    [onEdgesChange]
  );

  const addNode = useCallback(
    (type: string, position?: { x: number; y: number }) => {
      const viewport = rfInstanceRef.current?.getViewport();
      const pos = position ?? (viewport
        ? {
            x: Math.max(80, -viewport.x / viewport.zoom + 180),
            y: Math.max(80, -viewport.y / viewport.zoom + 120),
          }
        : { x: 300, y: 300 });
      const id = `${type}_${Date.now()}`;
      const module = createWorkflowNodeModule(type, pos);
      const newNode: CanvasNode = {
        id,
        type,
        position: pos,
        data: buildCanvasDataFromModule({ ...module, nodeId: id, position: pos }),
      };
      const currentModules = normalizedModulesRef.current;
      if (!currentModules.some((m) => m.nodeId === id)) {
        const nextModules = toWorkflowModules(currentModules, newNode);
        const nextCanvasNodes = toReactFlowNodes(nextModules);
        canvasNodesRef.current = nextCanvasNodes;
        setCanvasNodes(nextCanvasNodes);
        onNodesChange(nextModules);
      }
    },
    [onNodesChange]
  );
  // 用 ref 持有最新的 addNode，避免原生事件 Effect 因闭包过期反复重建
  const addNodeRef = useRef(addNode);
  addNodeRef.current = addNode;
  const deleteNodesByIds = useCallback((nodeIds: string[]) => {
    const deletableSet = new Set(
      canvasNodesRef.current.filter((node) => node.deletable !== false).map((node) => node.id)
    );
    const selectedSet = new Set(nodeIds.filter((id) => deletableSet.has(id)));
    if (selectedSet.size === 0) return;

    const nextNodes = canvasNodesRef.current.filter((node) => !selectedSet.has(node.id));
    const nextEdges = canvasEdgesRef.current.filter(
      (edge) => !selectedSet.has(edge.source) && !selectedSet.has(edge.target)
    );

    canvasNodesRef.current = nextNodes;
    canvasEdgesRef.current = nextEdges;
    setCanvasNodes(nextNodes);
    setCanvasEdges(nextEdges);
    onNodesChange(toWorkflowModules(nextNodes as CanvasNode[]));
    onEdgesChange(toWorkflowEdges(nextEdges));
  }, [onEdgesChange, onNodesChange]);

  const saveNodeConfig = useCallback((nodeId: string, payload: Record<string, any>) => {
    const nextNodes = canvasNodesRef.current.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          ...payload,
          _module: {
            ...(node.data?._module || {}),
            name: String(payload.label || node.data?.label || node.type || "未命名节点"),
          },
        },
      };
    });

    canvasNodesRef.current = nextNodes;
    setCanvasNodes(nextNodes);
    onNodesChange(toWorkflowModules(nextNodes as CanvasNode[]));
  }, [onNodesChange]);

  const editNodeById = useCallback((nodeId: string) => {
    const sourceNode = canvasNodesRef.current.find((node) => node.id === nodeId);
    if (!sourceNode) return;
    setEditingNode(sourceNode);
  }, []);

  const displayNodes = useMemo(
    () =>
      canvasNodes.map((node) => ({
        ...node,
        className: highlightNodeId === node.id ? "!ring-2 !ring-blue-400 !ring-offset-2 !rounded-xl" : undefined,
        data: {
          ...node.data,
          _actions: {
            active: !!node.selected,
            editable: node.deletable !== false && supportsConfigModal(node.type),
            deletable: node.deletable !== false,
            onEdit: () => editNodeById(node.id),
            onDelete: () => deleteNodesByIds([node.id]),
          },
        },
      })),
    [canvasNodes, deleteNodesByIds, editNodeById, highlightNodeId]
  );

  // 通过原生 DOM 事件监听拖放 —— ReactFlow 内部的 .react-flow__pane 不会
  // 转发 onDragOver/onDrop，导致浏览器的 drop 事件永远不会触发。
  // 用 document 级捕获阶段监听：无需等待 ReactFlow 渲染完毕，总能拦截到事件。
  useEffect(() => {
    const isInsideFlowCanvas = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return !!wrapperRef.current?.contains(target);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!isInsideFlowCanvas(e.target)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!isInsideFlowCanvas(e.target)) return;
      e.preventDefault();
      const type = e.dataTransfer?.getData("application/reactflow");
      if (!type) return;
      const position = rfInstanceRef.current?.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      }) || { x: 0, y: 0 };
      addNodeRef.current(type, position);
    };

    // 捕获阶段：在事件到达目标元素之前就 preventDefault，确保 drop 能被触发
    document.addEventListener("dragover", handleDragOver, true);
    document.addEventListener("drop", handleDrop, true);
    return () => {
      document.removeEventListener("dragover", handleDragOver, true);
      document.removeEventListener("drop", handleDrop, true);
    };
  }, []);

  // 拖放事件已改为原生 DOM 监听（见下方 useEffect），不再需要 React 合成事件回调

  return (
    <div className="flex h-full">
      <div className="w-48 shrink-0 border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto">
        <h3 className="mb-2 text-xs font-semibold text-gray-500 uppercase">节点模板</h3>
        {["ai", "logic", "tools", "interact", "output"].map((category) => {
          const catTemplates = NODE_TEMPLATES.filter((t) => t.category === category);
          if (catTemplates.length === 0) return null;
          const catLabels: Record<string, string> = { ai: "AI 智能", logic: "逻辑控制", tools: "工具", interact: "交互", output: "输出" };
          return (
            <div key={category} className="mb-3">
              <div className="mb-1 text-[10px] font-medium text-gray-400 uppercase">{catLabels[category] || category}</div>
              <div className="space-y-1">
                {catTemplates.map((t) => (
                  <div
                    key={t.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", t.type);
                      e.dataTransfer.setData("text/plain", t.type);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50 cursor-grab active:cursor-grabbing"
                  >
                    <span className="text-base">{t.icon}</span>
                    <div>
                      <div className="font-medium text-gray-700">{t.label}</div>
                      <div className="text-xs text-gray-400">{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="relative flex-1 h-full min-h-[600px]" ref={wrapperRef}>
        <ReactFlow
          nodes={displayNodes}
          edges={canvasEdges}
          onInit={handleInit}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          deleteKeyCode={["Backspace", "Delete"]}
          defaultEdgeOptions={{
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          }}
          className="bg-gray-50"
          style={{ width: "100%", height: "100%" }}
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      <NodeConfigModal
        open={!!editingNode}
        node={editingNode}
        datasets={datasetOptions}
        llmModels={llmModelOptions}
        loadingDatasets={loadingDatasets}
        onClose={() => setEditingNode(null)}
        onSave={(payload) => {
          if (!editingNode) return;
          saveNodeConfig(editingNode.id, payload);
          setEditingNode(null);
        }}
      />
    </div>
  );
}
