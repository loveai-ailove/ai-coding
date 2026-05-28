export enum FlowNodeTypeEnum {
  workflowStart = "workflowStart",
  chatNode = "chatNode",
  datasetSearchNode = "datasetSearchNode",
  answerNode = "answerNode",
  classifyQuestion = "classifyQuestion",
  contentExtract = "contentExtract",
  httpRequest468 = "httpRequest468",
  ifElseNode = "ifElseNode",
  variableUpdate = "variableUpdate",
  code = "code",
  textEditor = "textEditor",
  customFeedback = "customFeedback",
  queryExtension = "cfr",
  agent = "agent",
  toolCall = "tools",
  stopTool = "stopTool",
  toolParams = "toolParams",
  answer = "answerNode",
  appModule = "appModule",
  pluginModule = "pluginModule",
  pluginInput = "pluginInput",
  pluginOutput = "pluginOutput",
  loop = "loop",
  parallelRun = "parallelRun",
  nestedStart = "nestedStart",
  nestedEnd = "nestedEnd",
  formInput = "formInput",
  userSelect = "userSelect",
  readFiles = "readFiles",
  datasetConcatNode = "datasetConcatNode",
  tool = "tool",
  systemConfig = "userGuide",
  emptyNode = "emptyNode",
  comment = "comment",
}

export enum FlowNodeInputTypeEnum {
  reference = "reference",
  input = "input",
  textarea = "textarea",
  numberInput = "numberInput",
  switch = "switch",
  select = "select",
  multipleSelect = "multipleSelect",
  JSONEditor = "JSONEditor",
  addInputParam = "addInputParam",
  customVariable = "customVariable",
  selectApp = "selectApp",
  selectLLMModel = "selectLLMModel",
  settingLLMModel = "settingLLMModel",
  selectDataset = "selectDataset",
  selectDatasetParamsModal = "selectDatasetParamsModal",
  settingDatasetQuotePrompt = "settingDatasetQuotePrompt",
  hidden = "hidden",
  custom = "custom",
}

export enum NodeInputKeyEnum {
  userChatInput = "userChatInput",
  datasetSelectList = "datasets",
  datasetSimilarity = "similarity",
  datasetMaxTokens = "limit",
  datasetSearchMode = "searchMode",
  datasetSearchUsingReRank = "usingReRank",
  datasetSearchRerankModel = "rerankModel",
  datasetSearchRerankWeight = "rerankWeight",
  datasetSearchEmbeddingWeight = "embeddingWeight",
  datasetSearchUsingExtensionQuery = "usingExtensionQuery",
  datasetSearchExtensionModel = "extensionModel",
  datasetSearchExtensionBg = "extensionBg",
  collectionFilterMatch = "collectionFilterMatch",
  authTmbId = "authTmbId",
  datasetDeepSearch = "datasetDeepSearch",
  datasetDeepSearchModel = "datasetDeepSearchModel",
  datasetDeepSearchMaxTimes = "datasetDeepSearchMaxTimes",
  datasetDeepSearchBg = "datasetDeepSearchBg",
  httpReqUrl = "system_httpReqUrl",
  httpMethod = "system_httpMethod",
  httpHeaders = "system_httpHeader",
  httpJsonBody = "system_httpJsonBody",
  httpContentType = "system_httpContentType",
  httpTimeout = "system_httpTimeout",
  httpStatusCode = "system_httpCode",
  ifElseList = "ifElseList",
  variableUpdateList = "variableUpdateList",
  code = "system_code",
  codeType = "system_codeType",
  textEditorInputList = "system_textEditorInputList",
  textEditorTemplate = "system_textEditorTemplate",
  aiModel = "model",
  aiSystemPrompt = "system_chat_prompt",
  aiTemperature = "temperature",
  aiMaxToken = "maxToken",
}

export enum NodeOutputKeyEnum {
  answerText = "answerText",
  datasetQuoteQA = "quoteQA",
  httpResult = "httpResult",
  ifElseResult = "ifElseResult",
  codeResult = "codeResult",
  textEditorResult = "textEditorResult",
  agentResponse = "agentResponse",
}

export enum WorkflowIOValueTypeEnum {
  string = "string",
  number = "number",
  boolean = "boolean",
  object = "object",
  arrayString = "arrayString",
  arrayNumber = "arrayNumber",
  arrayObject = "arrayObject",
  arrayBoolean = "arrayBoolean",
  chatHistory = "chatHistory",
  datasetQuote = "datasetQuote",
  dynamic = "dynamic",
  any = "any",
}

export enum DispatchNodeResponseKeyEnum {
  nodeResponse = "responseData",
  toolResponses = "toolResponses",
  skipHandleId = "skipHandleId",
  runTimes = "runTimes",
  loopInput = "loopInput",
}

export enum SseResponseEventEnum {
  answer = "answer",
  flowNodeStatus = "flowNodeStatus",
  toolCall = "toolCall",
  toolResponse = "toolResponse",
  updateVariables = "updateVariables",
  interactive = "interactive",
}

export interface IfElseConditionType {
  variable: string[];
  condition: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains" | "empty" | "notEmpty";
  value: string;
}

export interface IfElseListItemType {
  conditions: IfElseConditionType[];
  condition?: "AND" | "OR";
}

export interface WorkflowNodeItemType {
  nodeId: string;
  name: string;
  intro: string;
  flowNodeType: FlowNodeTypeEnum;
  showStatus?: boolean;
  position: { x: number; y: number };
  inputs: Array<{
    key: string;
    value?: any;
    valueType?: WorkflowIOValueTypeEnum;
    valueDesc?: string;
    label?: string;
    description?: string;
    type?: FlowNodeInputTypeEnum;
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
  }>;
  outputs: Array<{
    key: string;
    label: string;
    description?: string;
    valueType?: WorkflowIOValueTypeEnum;
    type?: string;
    list?: Array<{ label: string; value: string }>;
    targets?: Array<{ moduleId: string; key: string }>;
    defaultValue?: any;
    required?: boolean;
  }>;
}

export interface WorkflowEdgeItemType {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}
