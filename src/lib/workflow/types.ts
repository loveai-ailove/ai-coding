import { FlowNodeTypeEnum, WorkflowIOValueTypeEnum, FlowNodeInputTypeEnum } from "./constants";

export type EdgeStatus = "active" | "waiting" | "skipped";

export interface RuntimeEdgeItemType {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  status?: EdgeStatus;
}

export interface RuntimeNodeItemType {
  nodeId: string;
  name: string;
  intro: string;
  flowNodeType: FlowNodeTypeEnum;
  showStatus?: boolean;
  avatar?: string;
  version?: string;
  position: { x: number; y: number };
  inputs: NodeInputItemType[];
  outputs: NodeOutputItemType[];
  catchError?: boolean;
}

export interface NodeInputItemType {
  key: string;
  value?: any;
  valueType?: WorkflowIOValueTypeEnum;
  valueDesc?: string;
  label?: string;
  description?: string;
  type?: FlowNodeInputTypeEnum;
  renderTypeList?: FlowNodeInputTypeEnum[];
  list?: Array<{ label: string; value: string }>;
  required?: boolean;
  selectedTypeIndex?: number;
  connected?: boolean;
  showTargetInApp?: boolean;
  showTargetInPlugin?: boolean;
  placeholder?: string;
  maxLength?: number;
  defaultValue?: any;
  min?: number;
  max?: number;
  dynamicParamDefaultValue?: any;
  canEdit?: boolean;
  editField?: Record<string, any>;
  customInputConfig?: Record<string, any>;
  md?: string;
  mist?: boolean;
}

export interface NodeOutputItemType {
  key: string;
  label?: string;
  description?: string;
  valueType?: WorkflowIOValueTypeEnum;
  type?: string;
  list?: Array<{ label: string; value: string }>;
  targets?: Array<{ moduleId: string; key: string }>;
  defaultValue?: any;
  required?: boolean;
  value?: any;
}

export type NodeEdgeGroups = RuntimeEdgeItemType[][];

export type NodeEdgeGroupsMap = Map<string, NodeEdgeGroups>;

export interface NodeDispatchResult<T = Record<string, any>, E = Record<string, any>> {
  data?: T;
  error?: E;
  skipHandleId?: string[];
  nodeResponse?: NodeResponseItemType;
  nodeResponses?: NodeResponseItemType[];
  answerText?: string;
  reasoningText?: string;
  childrenResponses?: NodeDispatchResult[];
  toolResponses?: any;
  assistantResponses?: Array<{
    text?: { content: string };
    reasoning?: { content: string };
    toolCalls?: any[];
  }>;
  rewriteHistories?: Array<{ obj: "Human" | "AI"; value: string }>;
  runTimes?: number;
  memories?: Record<string, any>;
  interactive?: InteractiveResponseType;
  customFeedbacks?: string[];
}

export interface NodeResponseItemType {
  id?: string;
  nodeId: string;
  moduleName?: string;
  moduleType?: string;
  moduleLogo?: string;
  runningTime?: number;
  error?: string;
  model?: string;
  tokens?: number;
  query?: string;
  totalPoints?: number;
  inputTokens?: number;
  outputTokens?: number;
  contextTotalLen?: number;
  [key: string]: any;
}

export interface InteractiveResponseType {
  type: "userSelect" | "formInput" | "paymentPause";
  params: Record<string, any>;
  planId?: string;
}

export interface WorkflowExecutionLogItem {
  nodeId: string;
  moduleName?: string;
  moduleType?: string;
  status: "queued" | "run" | "skip" | "wait" | "error" | "interactive";
  message?: string;
  timestamp: string;
  detail?: Record<string, any>;
}

export interface NodeDebugSnapshot {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "run" | "skip" | "wait" | "error";
  resolvedInputs: Record<string, any>;
  outputs: Record<string, any>;
  runningTime?: number;
  error?: string;
  timestamp: string;
  /** LLM request details for AI nodes (chatNode, agent, etc.) */
  llmRequest?: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    [key: string]: any;
  };
}

export interface DispatchContext {
  userId: string;
  appId: string;
  chatId?: string;
  responseChatItemId?: string;
  variables: Record<string, any>;
  variableRecord: Record<string, any>;
  histories: Array<{ obj: "Human" | "AI"; value: string }>;
  userChatInput: string;
  query: string;
  runtimeNodes: RuntimeNodeItemType[];
  runtimeEdges: RuntimeEdgeItemType[];
  runtimeNodesMap?: Map<string, RuntimeNodeItemType>;
  nodeOutputMap?: Map<string, Record<string, any>>;
  mode?: "chat" | "debug";
  isToolCall?: boolean;
  isRootRuntime?: boolean;
  maxRunTimes?: number;
  workflowDispatchDeep?: number;
  chatConfig?: {
    welcomeText?: string;
    variables?: Array<{ key: string; label: string; type: string; defaultValue?: any; required?: boolean; valueType?: string }>;
    questionGuide?: { open: boolean; model?: string };
    fileSelectConfig?: { open: boolean; maxSize?: number };
    instruction?: string;
  };
  streamResponse?: (event: string, data: string | Record<string, any>) => void;
  executionLogs?: WorkflowExecutionLogItem[];
}
