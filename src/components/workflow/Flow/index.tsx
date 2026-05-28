"use client";

import { useCallback, useMemo, useRef, useEffect } from "react";
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

const START_NODE_ID = "workflowStart";
const START_NODE_POSITION = { x: 100, y: 200 };

const NODE_TEMPLATES = [
  { type: "chatNode", label: "AI 对话", icon: "🤖", desc: "调用LLM进行对话" },
  { type: "datasetSearchNode", label: "知识库搜索", icon: "📚", desc: "检索知识库内容" },
  { type: "answerNode", label: "回答输出", icon: "💬", desc: "输出最终回答" },
  { type: "ifElseNode", label: "条件分支", icon: "🔀", desc: "根据条件走不同分支" },
  { type: "httpRequest468", label: "HTTP 请求", icon: "🌐", desc: "调用外部API" },
  { type: "code", label: "代码执行", icon: "⚡", desc: "运行自定义代码" },
  { type: "variableUpdate", label: "变量更新", icon: "📝", desc: "更新工作流变量" },
];

function StartNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-green-400 bg-green-50 px-4 py-3 shadow-sm">
      <div className="text-sm font-semibold text-green-700">开始</div>
      <div className="mt-1 text-xs text-green-500">{String(data.label || "用户输入")}</div>
      <Handle type="source" position={Position.Right} className="!bg-green-500" />
    </div>
  );
}

function ChatNodeComponent({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-blue-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>🤖</span>
        <span className="text-sm font-semibold text-gray-800">AI 对话</span>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        模型: {String(data.model || "默认")}
      </div>
      {String(data.systemPrompt || "") && (
        <div className="mt-1 line-clamp-2 text-xs text-gray-400">{String(data.systemPrompt).slice(0, 50)}...</div>
      )}
      <Handle type="source" position={Position.Right} id="answerText" className="!bg-blue-500" />
    </div>
  );
}

function DatasetSearchNodeComponent(_: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-yellow-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>📚</span>
        <span className="text-sm font-semibold text-gray-800">知识库搜索</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">搜索知识库</div>
      <Handle type="source" position={Position.Right} id="quoteQA" className="!bg-yellow-500" />
    </div>
  );
}

function AnswerNodeComponent({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-purple-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>💬</span>
        <span className="text-sm font-semibold text-gray-800">回答输出</span>
      </div>
      <div className="mt-1 line-clamp-3 text-xs text-gray-500">
        {String(data.answerText || "输出回答内容")}
      </div>
    </div>
  );
}

function IfElseNodeComponent({ data }: NodeProps) {
  const conditions = (data.ifElseList || []) as any[];
  return (
    <div className="rounded-lg border-2 border-orange-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>🔀</span>
        <span className="text-sm font-semibold text-gray-800">条件分支</span>
      </div>
      {conditions.map((_: any, i: number) => (
        <Handle key={`if-${i}`} type="source" position={Position.Right} id={`ifElse-result-${i}`} style={{ top: 30 + i * 16 }} className="!bg-orange-400" />
      ))}
      <Handle type="source" position={Position.Right} id="ifElse-else" style={{ top: 30 + conditions.length * 16 }} className="!bg-gray-400" />
    </div>
  );
}

function HttpNodeComponent({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-cyan-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>🌐</span>
        <span className="text-sm font-semibold text-gray-800">HTTP 请求</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">{String(data.method || "GET")} {String(data.url || "未设置")}</div>
      <Handle type="source" position={Position.Right} className="!bg-cyan-500" />
    </div>
  );
}

function CodeNodeComponent({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-gray-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>⚡</span>
        <span className="text-sm font-semibold text-gray-800">代码执行</span>
      </div>
      <div className="mt-1 line-clamp-2 text-xs font-mono text-gray-400">
        {String(data.code || "// 代码")}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-gray-500" />
    </div>
  );
}

function VariableUpdateNodeComponent(_: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-pink-400 bg-white px-4 py-3 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span>📝</span>
        <span className="text-sm font-semibold text-gray-800">变量更新</span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-pink-500" />
    </div>
  );
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
};

type CanvasNode = Node<Record<string, any>>;

function createStartModule() {
  return {
    nodeId: START_NODE_ID,
    name: "开始",
    intro: "",
    flowNodeType: "workflowStart",
    position: START_NODE_POSITION,
    inputs: [],
    outputs: [],
  };
}

function ensureStartModule(modules: any[]): any[] {
  const safeModules = Array.isArray(modules) ? modules : [];
  if (safeModules.some((module) => module?.flowNodeType === "workflowStart")) {
    return safeModules;
  }
  return [createStartModule(), ...safeModules];
}

function buildModuleInputs(data: Record<string, any>, previousInputs: any[] = []) {
  const inputMap = new Map(
    (previousInputs || []).map((input) => [input.key, { ...input }])
  );

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_") || key === "label") continue;
    const previousInput = inputMap.get(key) || { key };
    inputMap.set(key, { ...previousInput, value });
  }

  return Array.from(inputMap.values());
}

function toWorkflowModules(nodes: CanvasNode[]): any[] {
  const modules = nodes.map((node) => {
    const data = (node.data || {}) as Record<string, any>;
    const previousModule = data._module || {};

    return {
      ...previousModule,
      nodeId: node.id,
      name: String(data.label || previousModule.name || node.type || "未命名节点"),
      intro: previousModule.intro || "",
      flowNodeType: node.type,
      position: node.position,
      inputs: buildModuleInputs(data, previousModule.inputs),
      outputs: previousModule.outputs || [],
    };
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
  return ensureStartModule(modules).map((m) => ({
    id: m.nodeId,
    type: m.flowNodeType || "chatNode",
    position: m.position || { x: 0, y: 0 },
    deletable: m.flowNodeType !== "workflowStart",
    data: {
      ...Object.fromEntries((m.inputs || []).map((i: any) => [i.key, i.value])),
      label: m.name,
      model: m.inputs?.find((i: any) => i.key === "model")?.value,
      systemPrompt: m.inputs?.find((i: any) => i.key === "system_chat_prompt")?.value,
      answerText: m.inputs?.find((i: any) => i.key === "answerText")?.value,
      url: m.inputs?.find((i: any) => i.key === "system_httpReqUrl")?.value,
      method: m.inputs?.find((i: any) => i.key === "system_httpMethod")?.value,
      code: m.inputs?.find((i: any) => i.key === "system_code")?.value,
      ifElseList: m.inputs?.find((i: any) => i.key === "ifElseList")?.value,
      _module: m,
    },
  }));
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
}: {
  nodes: any[];
  edges: any[];
  onNodesChange: (nodes: any[]) => void;
  onEdgesChange: (edges: any[]) => void;
}) {
  const normalizedModuleNodes = useMemo(() => ensureStartModule(moduleNodes), [moduleNodes]);
  const rfNodes = useMemo(() => toReactFlowNodes(normalizedModuleNodes), [normalizedModuleNodes]);
  const rfEdges = useMemo(() => toReactFlowEdges(moduleEdges), [moduleEdges]);
  const rfInstanceRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);

  useEffect(() => {
    if (!moduleNodes.some((node) => node?.flowNodeType === "workflowStart")) {
      onNodesChange(normalizedModuleNodes);
    }
  }, [moduleNodes, normalizedModuleNodes, onNodesChange]);

  const handleInit: OnInit<CanvasNode, Edge> = useCallback((instance) => {
    rfInstanceRef.current = instance;
  }, []);

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
        rfEdges
      );
      onEdgesChange(toWorkflowEdges(nextEdges));
    },
    [onEdgesChange, rfEdges]
  );

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const nextNodes = applyNodeChanges(changes, rfNodes);
      onNodesChange(toWorkflowModules(nextNodes as CanvasNode[]));
    },
    [onNodesChange, rfNodes]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const nextEdges = applyEdgeChanges(changes, rfEdges);
      onEdgesChange(toWorkflowEdges(nextEdges));
    },
    [onEdgesChange, rfEdges]
  );

  const addNode = useCallback(
    (type: string) => {
      const viewport = rfInstanceRef.current?.getViewport();
      const pos = viewport
        ? {
            x: Math.max(80, -viewport.x / viewport.zoom + 180),
            y: Math.max(80, -viewport.y / viewport.zoom + 120),
          }
        : { x: 300, y: 300 };
      const id = `${type}_${Date.now()}`;
      const newNode: CanvasNode = {
        id,
        type,
        position: pos,
        data: { label: NODE_TEMPLATES.find((t) => t.type === type)?.label || type },
      };
      onNodesChange(toWorkflowModules([...rfNodes, newNode]));
    },
    [onNodesChange, rfNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;
      const position = rfInstanceRef.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) || { x: 0, y: 0 };
      const id = `${type}_${Date.now()}`;
      const newNode: CanvasNode = { id, type, position, data: { label: NODE_TEMPLATES.find((t) => t.type === type)?.label || type } };
      onNodesChange(toWorkflowModules([...rfNodes, newNode]));
    },
    [onNodesChange, rfNodes]
  );

  return (
    <div className="flex h-full">
      <div className="w-48 shrink-0 border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto">
        <h3 className="mb-2 text-xs font-semibold text-gray-500 uppercase">节点模板</h3>
        <div className="space-y-1">
          {NODE_TEMPLATES.map((t) => (
            <button
              key={t.type}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/reactflow", t.type);
                e.dataTransfer.setData("text/plain", t.type);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => addNode(t.type)}
              className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50 cursor-grab"
            >
              <span className="text-base">{t.icon}</span>
              <div>
                <div className="font-medium text-gray-700">{t.label}</div>
                <div className="text-xs text-gray-400">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onInit={handleInit}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          deleteKeyCode={["Backspace", "Delete"]}
          defaultEdgeOptions={{
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          }}
          fitView
          className="bg-gray-50"
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
