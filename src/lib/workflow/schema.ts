import {
  FlowNodeInputTypeEnum,
  FlowNodeTypeEnum,
  NodeInputKeyEnum,
  NodeOutputKeyEnum,
  WorkflowIOValueTypeEnum,
  type WorkflowNodeItemType,
} from "./constants";

type WorkflowInputItem = WorkflowNodeItemType["inputs"][number];
type WorkflowOutputItem = WorkflowNodeItemType["outputs"][number];

export interface WorkflowNodeSchema {
  type: string;
  label: string;
  intro: string;
  inputs: WorkflowInputItem[];
  outputs: WorkflowOutputItem[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function createInput(input: WorkflowInputItem): WorkflowInputItem {
  return input;
}

function createOutput(output: WorkflowOutputItem): WorkflowOutputItem {
  return output;
}

export const GLOBAL_VARIABLE_NODE_ID = "systemVariable";

export const workflowNodeSchemaMap: Record<string, WorkflowNodeSchema> = {
  [FlowNodeTypeEnum.workflowStart]: {
    type: FlowNodeTypeEnum.workflowStart,
    label: "开始",
    intro: "工作流开始节点",
    inputs: [],
    outputs: [
      createOutput({
        key: NodeOutputKeyEnum.answerText,
        label: "用户输入",
        valueType: WorkflowIOValueTypeEnum.string,
        required: true,
      }),
    ],
  },
  [FlowNodeTypeEnum.chatNode]: {
    type: FlowNodeTypeEnum.chatNode,
    label: "AI 对话",
    intro: "调用大模型生成回复",
    inputs: [
      createInput({
        key: NodeInputKeyEnum.aiModel,
        label: "模型",
        type: FlowNodeInputTypeEnum.input,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "",
      }),
      createInput({
        key: "modelName",
        label: "模型名称",
        type: FlowNodeInputTypeEnum.hidden,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "",
      }),
      createInput({
        key: "modelCode",
        label: "模型编码",
        type: FlowNodeInputTypeEnum.hidden,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "",
      }),
      createInput({
        key: NodeInputKeyEnum.aiSystemPrompt,
        label: "System Prompt",
        type: FlowNodeInputTypeEnum.textarea,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "",
      }),
      createInput({
        key: NodeInputKeyEnum.history,
        label: "历史轮数",
        type: FlowNodeInputTypeEnum.numberInput,
        valueType: WorkflowIOValueTypeEnum.number,
        defaultValue: 6,
      }),
      createInput({
        key: NodeInputKeyEnum.aiTemperature,
        label: "温度",
        type: FlowNodeInputTypeEnum.numberInput,
        valueType: WorkflowIOValueTypeEnum.number,
        defaultValue: 0.7,
      }),
      createInput({
        key: NodeInputKeyEnum.aiMaxToken,
        label: "最大 Token",
        type: FlowNodeInputTypeEnum.numberInput,
        valueType: WorkflowIOValueTypeEnum.number,
        defaultValue: 32000,
      }),
      createInput({
        key: NodeInputKeyEnum.userChatInput,
        label: "问题输入",
        type: FlowNodeInputTypeEnum.reference,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: [GLOBAL_VARIABLE_NODE_ID, NodeInputKeyEnum.userChatInput],
        connected: true,
        showTargetInApp: false,
      }),
      createInput({
        key: NodeOutputKeyEnum.datasetQuoteQA,
        label: "知识库结果",
        type: FlowNodeInputTypeEnum.reference,
        valueType: WorkflowIOValueTypeEnum.datasetQuote,
        defaultValue: [],
        connected: true,
        showTargetInApp: true,
      }),
      createInput({
        key: NodeInputKeyEnum.isResponseAnswerText,
        label: "输出回复",
        type: FlowNodeInputTypeEnum.switch,
        valueType: WorkflowIOValueTypeEnum.boolean,
        defaultValue: true,
      }),
    ],
    outputs: [
      createOutput({
        key: NodeOutputKeyEnum.answerText,
        label: "回答文本",
        valueType: WorkflowIOValueTypeEnum.string,
        required: true,
      }),
    ],
  },
  [FlowNodeTypeEnum.datasetSearchNode]: {
    type: FlowNodeTypeEnum.datasetSearchNode,
    label: "知识库搜索",
    intro: "从知识库召回相关内容",
    inputs: [
      createInput({
        key: NodeInputKeyEnum.datasetSelectList,
        label: "知识库",
        type: FlowNodeInputTypeEnum.selectDataset,
        valueType: WorkflowIOValueTypeEnum.arrayObject,
        defaultValue: [],
      }),
      createInput({
        key: NodeInputKeyEnum.datasetSimilarity,
        label: "相似度",
        type: FlowNodeInputTypeEnum.numberInput,
        valueType: WorkflowIOValueTypeEnum.number,
        defaultValue: 0.4,
      }),
      createInput({
        key: NodeInputKeyEnum.datasetMaxTokens,
        label: "返回上限",
        type: FlowNodeInputTypeEnum.numberInput,
        valueType: WorkflowIOValueTypeEnum.number,
        defaultValue: 5000,
      }),
      createInput({
        key: NodeInputKeyEnum.datasetSearchMode,
        label: "检索模式",
        type: FlowNodeInputTypeEnum.select,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "semantic",
      }),
      createInput({
        key: NodeInputKeyEnum.userChatInput,
        label: "检索问题",
        type: FlowNodeInputTypeEnum.reference,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: [GLOBAL_VARIABLE_NODE_ID, NodeInputKeyEnum.userChatInput],
        connected: true,
        showTargetInApp: true,
      }),
    ],
    outputs: [
      createOutput({
        key: NodeOutputKeyEnum.datasetQuoteQA,
        label: "引用结果",
        valueType: WorkflowIOValueTypeEnum.datasetQuote,
        required: true,
      }),
    ],
  },
  [FlowNodeTypeEnum.answerNode]: {
    type: FlowNodeTypeEnum.answerNode,
    label: "指定回复",
    intro: "输出固定或拼装后的回复",
    inputs: [
      createInput({
        key: NodeOutputKeyEnum.answerText,
        label: "回复内容",
        type: FlowNodeInputTypeEnum.textarea,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "",
        connected: true,
        showTargetInApp: true,
      }),
    ],
    outputs: [
      createOutput({
        key: NodeOutputKeyEnum.answerText,
        label: "回复内容",
        valueType: WorkflowIOValueTypeEnum.string,
        required: true,
      }),
    ],
  },
  [FlowNodeTypeEnum.ifElseNode]: {
    type: FlowNodeTypeEnum.ifElseNode,
    label: "条件分支",
    intro: "判断条件后走不同分支",
    inputs: [
      createInput({
        key: NodeInputKeyEnum.ifElseList,
        label: "分支条件",
        type: FlowNodeInputTypeEnum.JSONEditor,
        valueType: WorkflowIOValueTypeEnum.arrayObject,
        defaultValue: [],
      }),
    ],
    outputs: [
      createOutput({
        key: NodeOutputKeyEnum.ifElseResult,
        label: "分支结果",
        valueType: WorkflowIOValueTypeEnum.string,
      }),
    ],
  },
  [FlowNodeTypeEnum.httpRequest468]: {
    type: FlowNodeTypeEnum.httpRequest468,
    label: "HTTP 请求",
    intro: "请求外部接口",
    inputs: [
      createInput({
        key: NodeInputKeyEnum.httpMethod,
        label: "请求方法",
        type: FlowNodeInputTypeEnum.select,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "GET",
      }),
      createInput({
        key: NodeInputKeyEnum.httpReqUrl,
        label: "请求地址",
        type: FlowNodeInputTypeEnum.input,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "",
      }),
      createInput({
        key: NodeInputKeyEnum.httpHeaders,
        label: "请求头",
        type: FlowNodeInputTypeEnum.JSONEditor,
        valueType: WorkflowIOValueTypeEnum.arrayObject,
        defaultValue: [],
      }),
      createInput({
        key: NodeInputKeyEnum.httpJsonBody,
        label: "请求体",
        type: FlowNodeInputTypeEnum.JSONEditor,
        valueType: WorkflowIOValueTypeEnum.any,
        defaultValue: "",
        connected: true,
        showTargetInApp: true,
      }),
      createInput({
        key: NodeInputKeyEnum.httpTimeout,
        label: "超时时间",
        type: FlowNodeInputTypeEnum.numberInput,
        valueType: WorkflowIOValueTypeEnum.number,
        defaultValue: 30,
      }),
    ],
    outputs: [
      createOutput({
        key: NodeOutputKeyEnum.httpResult,
        label: "响应结果",
        valueType: WorkflowIOValueTypeEnum.any,
        required: true,
      }),
    ],
  },
  [FlowNodeTypeEnum.formInput]: {
    type: FlowNodeTypeEnum.formInput,
    label: "表单输入",
    intro: "向用户收集结构化信息",
    inputs: [
      createInput({
        key: "description",
        label: "说明文案",
        type: FlowNodeInputTypeEnum.textarea,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "",
      }),
      createInput({
        key: "userInputForms",
        label: "表单项",
        type: FlowNodeInputTypeEnum.JSONEditor,
        valueType: WorkflowIOValueTypeEnum.arrayObject,
        defaultValue: [],
      }),
    ],
    outputs: [
      createOutput({
        key: NodeOutputKeyEnum.formInputResult,
        label: "表单结果",
        valueType: WorkflowIOValueTypeEnum.object,
      }),
    ],
  },
  [FlowNodeTypeEnum.userSelect]: {
    type: FlowNodeTypeEnum.userSelect,
    label: "用户选择",
    intro: "等待用户选择分支",
    inputs: [
      createInput({
        key: "description",
        label: "说明文案",
        type: FlowNodeInputTypeEnum.textarea,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "",
      }),
      createInput({
        key: "userSelectOptions",
        label: "选项列表",
        type: FlowNodeInputTypeEnum.JSONEditor,
        valueType: WorkflowIOValueTypeEnum.arrayObject,
        defaultValue: [],
      }),
    ],
    outputs: [
      createOutput({
        key: NodeOutputKeyEnum.userSelectResult,
        label: "选择结果",
        valueType: WorkflowIOValueTypeEnum.string,
      }),
    ],
  },
  [FlowNodeTypeEnum.customFeedback]: {
    type: FlowNodeTypeEnum.customFeedback,
    label: "指定回复",
    intro: "输出固定反馈",
    inputs: [
      createInput({
        key: "feedbackText",
        label: "反馈文本",
        type: FlowNodeInputTypeEnum.textarea,
        valueType: WorkflowIOValueTypeEnum.string,
        defaultValue: "",
      }),
    ],
    outputs: [
      createOutput({
        key: NodeOutputKeyEnum.customFeedbackResult,
        label: "反馈结果",
        valueType: WorkflowIOValueTypeEnum.string,
      }),
    ],
  },
};

export function getWorkflowNodeSchema(type?: string): WorkflowNodeSchema | undefined {
  if (!type) return undefined;
  return workflowNodeSchemaMap[type];
}

function mergeInputs(schemaInputs: WorkflowInputItem[], currentInputs: WorkflowInputItem[] = []) {
  const currentMap = new Map(currentInputs.map((input) => [input.key, clone(input)]));
  const merged: WorkflowInputItem[] = schemaInputs.map((input) => {
    const current = currentMap.get(input.key);
    return {
      ...clone(input),
      ...current,
      key: input.key,
      label: current?.label || input.label,
      value:
        current?.value !== undefined
          ? current.value
          : current?.defaultValue !== undefined
            ? current.defaultValue
            : clone(input.defaultValue),
      defaultValue:
        current?.defaultValue !== undefined ? current.defaultValue : clone(input.defaultValue),
    };
  });

  for (const input of currentInputs) {
    if (!schemaInputs.some((item) => item.key === input.key)) {
      merged.push(clone(input) as WorkflowInputItem);
    }
  }

  return merged;
}

function mergeOutputs(schemaOutputs: WorkflowOutputItem[], currentOutputs: WorkflowOutputItem[] = []) {
  const currentMap = new Map(currentOutputs.map((output) => [output.key, clone(output)]));
  const merged: WorkflowOutputItem[] = schemaOutputs.map((output) => {
    const current = currentMap.get(output.key);
    return {
      ...clone(output),
      ...current,
      key: output.key,
      label: current?.label || output.label,
    };
  });

  for (const output of currentOutputs) {
    if (!schemaOutputs.some((item) => item.key === output.key)) {
      merged.push(clone(output) as WorkflowOutputItem);
    }
  }

  return merged;
}

function shouldResetUserChatInput(module: WorkflowNodeItemType, input: WorkflowInputItem) {
  if (input.key !== NodeInputKeyEnum.userChatInput) return false;

  const supportedNodeTypes = [
    FlowNodeTypeEnum.chatNode,
    FlowNodeTypeEnum.datasetSearchNode,
  ];

  if (!supportedNodeTypes.includes(module.flowNodeType)) return false;

  const value = input.value;
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) {
    return value.length === 0 || !(value.length === 2 && value.every((item) => typeof item === "string"));
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return true;
    if (text.startsWith("{") || text.startsWith("[")) {
      return true;
    }
    return false;
  }

  if (typeof value === "object") return true;

  return false;
}

export function normalizeWorkflowNode(module: WorkflowNodeItemType): WorkflowNodeItemType {
  const schema = getWorkflowNodeSchema(module.flowNodeType);
  if (!schema) return clone(module);

  const mergedInputs = mergeInputs(schema.inputs, module.inputs).map((input) => {
    if (!shouldResetUserChatInput(module, input)) {
      return input;
    }

    const schemaInput = schema.inputs.find((item) => item.key === input.key);
    const fallbackValue = clone(schemaInput?.defaultValue);

    return {
      ...input,
      value: fallbackValue,
      defaultValue: fallbackValue,
    };
  });

  return {
    ...clone(module),
    name: module.name || schema.label,
    intro: module.intro || schema.intro,
    inputs: mergedInputs,
    outputs: mergeOutputs(schema.outputs, module.outputs),
  };
}

export function normalizeWorkflowModules(modules: WorkflowNodeItemType[]) {
  return (modules || []).map((module) => normalizeWorkflowNode(module));
}

export function createWorkflowNodeModule(type: string, position: { x: number; y: number }): WorkflowNodeItemType {
  const schema = getWorkflowNodeSchema(type);
  if (!schema) {
    return {
      nodeId: `${type}_${Date.now()}`,
      name: type,
      intro: "",
      flowNodeType: type as FlowNodeTypeEnum,
      position,
      inputs: [],
      outputs: [],
    };
  }

  return {
    nodeId: `${type}_${Date.now()}`,
    name: schema.label,
    intro: schema.intro,
    flowNodeType: type as FlowNodeTypeEnum,
    position,
    inputs: mergeInputs(schema.inputs),
    outputs: mergeOutputs(schema.outputs),
  };
}

export function getNodeConnectableInputs(module?: Partial<WorkflowNodeItemType>) {
  return (module?.inputs || []).filter((input) => input.showTargetInApp);
}

export function getNodeConnectableOutputs(module?: Partial<WorkflowNodeItemType>) {
  return module?.outputs || [];
}
