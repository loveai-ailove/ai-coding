"use client";

import { useEffect, useMemo, useState } from "react";

export interface DatasetOption {
  id: string;
  name: string;
  embeddingModelId?: string;
  embeddingModelName?: string;
  vectorModel?: string;
  type?: string;
}

export interface LlmModelOption {
  id: string;
  name: string;
  model: string;
}

type EditableNodeType =
  | "chatNode"
  | "datasetSearchNode"
  | "ifElseNode"
  | "httpRequest468"
  | "formInput"
  | "userSelect"
  | "answerNode";

interface NodeConfigModalProps {
  open: boolean;
  node: {
    id: string;
    type?: string;
    data?: Record<string, any>;
  } | null;
  datasets: DatasetOption[];
  llmModels: LlmModelOption[];
  loadingDatasets?: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, any>) => void;
}

const conditionOptions = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "not_contains", label: "不包含" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "empty", label: "为空" },
  { value: "notEmpty", label: "不为空" },
];

const formFieldTypes = [
  { value: "input", label: "单行输入" },
  { value: "textarea", label: "多行输入" },
  { value: "select", label: "下拉选择" },
];

function isEditableNodeType(type: string | undefined): type is EditableNodeType {
  return [
    "chatNode",
    "datasetSearchNode",
    "ifElseNode",
    "httpRequest468",
    "formInput",
    "userSelect",
    "answerNode",
  ].includes(type || "");
}

function cloneData(data: Record<string, any> | undefined) {
  return JSON.parse(JSON.stringify(data || {}));
}

function buildSafeKey(input: string, fallbackPrefix: string, index: number) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `${fallbackPrefix}_${index + 1}`;
}

function pathToString(path: unknown): string {
  return Array.isArray(path) ? path.join(".") : "";
}

function stringToPath(path: unknown): string[] {
  if (typeof path !== "string") return [];
  return path
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptions(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, rawValue] = line.includes(":") ? line.split(":") : [line, line];
      const value = (rawValue || label).trim();
      return {
        label: label.trim(),
        value,
        key: buildSafeKey(value, "option", index),
      };
    });
}

function stringifyOptions(list: any[] | undefined) {
  return (list || [])
    .map((item) => `${item?.label || item?.value || ""}:${item?.value || item?.label || ""}`)
    .join("\n");
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-gray-700">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-gray-700">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-gray-700">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NodeConfigModal({
  open,
  node,
  datasets,
  llmModels,
  loadingDatasets = false,
  onClose,
  onSave,
}: NodeConfigModalProps) {
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!open || !node) return;
    setForm(cloneData(node.data));
  }, [node, open]);

  const nodeType = node?.type;
  const modalTitle = useMemo(() => {
    if (!node) return "节点配置";
    return `${node.data?.label || "节点"} 配置`;
  }, [node]);

  if (!open || !node || !nodeType || !isEditableNodeType(nodeType)) {
    return null;
  }

  const save = () => {
    const payload = cloneData(form);
    payload.label = String(payload.label || node.data?.label || "").trim() || "未命名节点";

    if (nodeType === "chatNode") {
      payload.history = Number(payload.history || 6);
      payload.temperature = Number(payload.temperature || 0.7);
      payload.maxToken = Number(payload.maxToken || 32000);
      const selectedModel = llmModels.find((item) => item.id === String(payload.model || ""));
      if (selectedModel) {
        payload.modelName = selectedModel.name;
        payload.modelCode = selectedModel.model;
      }
    }

    if (nodeType === "datasetSearchNode") {
      payload.similarity = Number(payload.similarity || 0.4);
      payload.limit = Number(payload.limit || 5000);
      payload.datasets = (payload.datasets || []).map((item: any) => ({
        id: item.id,
        datasetId: item.datasetId || item.id,
        name: item.name,
        embeddingModelId: item.embeddingModelId,
        embeddingModelName: item.embeddingModelName,
        vectorModel: item.vectorModel,
      }));
    }

    if (nodeType === "ifElseNode") {
      payload.ifElseList = (payload.ifElseList || [])
        .map((branch: any) => ({
          condition: branch.condition === "OR" ? "OR" : "AND",
          conditions: (branch.conditions || [])
            .map((condition: any) => ({
              variable: stringToPath(condition.variablePath || pathToString(condition.variable)),
              condition: condition.condition || "eq",
              value: condition.value || "",
            }))
            .filter((condition: any) => condition.variable.length > 0),
        }))
        .filter((branch: any) => branch.conditions.length > 0);
    }

    if (nodeType === "httpRequest468") {
      payload.system_httpTimeout = Number(payload.system_httpTimeout || 30);
      payload.system_httpHeader = (payload.system_httpHeader || []).filter(
        (item: any) => item?.key || item?.value
      );

      const rawBody = String(payload.system_httpJsonBody || "").trim();
      if (!rawBody) {
        payload.system_httpJsonBody = "";
      } else {
        try {
          payload.system_httpJsonBody = JSON.parse(rawBody);
        } catch {
          payload.system_httpJsonBody = rawBody;
        }
      }
    }

    if (nodeType === "formInput") {
      payload.userInputForms = (payload.userInputForms || [])
        .map((item: any, index: number) => {
          const label = String(item.label || "").trim();
          const key = String(item.key || "").trim() || buildSafeKey(label, "field", index);
          return {
            key,
            label: label || `字段 ${index + 1}`,
            type: item.type || "input",
            required: !!item.required,
            description: item.description || "",
            defaultValue: item.defaultValue || "",
            list: item.type === "select" ? parseOptions(item.optionsText || "") : [],
          };
        })
        .filter((item: any) => item.label);
    }

    if (nodeType === "userSelect") {
      payload.userSelectOptions = (payload.userSelectOptions || [])
        .map((item: any, index: number) => {
          const value = String(item.value || "").trim();
          return {
            key: String(item.key || "").trim() || buildSafeKey(value, "option", index),
            value: value || `选项 ${index + 1}`,
          };
        })
        .filter((item: any) => item.value);
    }

    if (nodeType === "answerNode") {
      payload.answerText = String(payload.answerText || "");
    }

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-gray-900">{modalTitle}</div>
            <div className="mt-1 text-xs text-gray-500">常用配置字段</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            关闭
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <TextInput
            label="节点名称"
            value={String(form.label || node.data?.label || "")}
            onChange={(value) => setForm((prev) => ({ ...prev, label: value }))}
            placeholder="请输入节点名称"
          />

          {nodeType === "chatNode" && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectInput
                  label="模型"
                  value={String(form.model || llmModels[0]?.id || "")}
                  onChange={(value) => setForm((prev) => ({ ...prev, model: value }))}
                  options={
                    llmModels.length > 0
                      ? llmModels.map((item) => ({
                          value: item.id,
                          label: `${item.name} (${item.model})`,
                        }))
                      : [{ value: "", label: "暂无可用模型" }]
                  }
                />
                <TextInput
                  label="历史轮数"
                  value={String(form.history ?? 6)}
                  onChange={(value) => setForm((prev) => ({ ...prev, history: value }))}
                  type="number"
                />
              </div>
              <TextArea
                label="System Prompt"
                value={String(form.system_chat_prompt || "")}
                onChange={(value) => setForm((prev) => ({ ...prev, system_chat_prompt: value, systemPrompt: value }))}
                placeholder="给模型的角色设定和回答要求"
                rows={5}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="温度"
                  value={String(form.temperature ?? 0.7)}
                  onChange={(value) => setForm((prev) => ({ ...prev, temperature: value }))}
                  type="number"
                />
                <TextInput
                  label="最大 Token"
                  value={String(form.maxToken ?? 32000)}
                  onChange={(value) => setForm((prev) => ({ ...prev, maxToken: value }))}
                  type="number"
                />
              </div>
            </>
          )}

          {nodeType === "datasetSearchNode" && (
            <>
              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">关联知识库</div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  {loadingDatasets ? (
                    <div className="text-sm text-gray-500">知识库加载中...</div>
                  ) : datasets.length === 0 ? (
                    <div className="text-sm text-gray-500">暂无可选知识库，请先创建知识库。</div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {datasets.map((dataset) => {
                        const selected = (form.datasets || []).some((item: any) => {
                          const id = item?.id || item?.datasetId || item;
                          return id === dataset.id;
                        });
                        return (
                          <label
                            key={dataset.id}
                            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                              selected ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                setForm((prev) => {
                                  const current = [...(prev.datasets || [])];
                                  if (e.target.checked) {
                                    return {
                                      ...prev,
                                      datasets: [
                                        ...current,
                                        {
                                          id: dataset.id,
                                          datasetId: dataset.id,
                                          name: dataset.name,
                                          embeddingModelId: dataset.embeddingModelId,
                                          embeddingModelName: dataset.embeddingModelName,
                                          vectorModel: dataset.vectorModel,
                                        },
                                      ],
                                    };
                                  }

                                  return {
                                    ...prev,
                                    datasets: current.filter((item: any) => {
                                      const id = item?.id || item?.datasetId || item;
                                      return id !== dataset.id;
                                    }),
                                  };
                                });
                              }}
                              className="mt-1"
                            />
                            <div>
                              <div className="font-medium text-gray-800">{dataset.name}</div>
                              <div className="text-xs text-gray-500">{dataset.vectorModel || "默认向量模型"}</div>
                              {dataset.embeddingModelName ? (
                                <div className="text-xs text-gray-400">嵌入模型: {dataset.embeddingModelName}</div>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <TextInput
                  label="相似度阈值"
                  value={String(form.similarity ?? 0.4)}
                  onChange={(value) => setForm((prev) => ({ ...prev, similarity: value }))}
                  type="number"
                />
                <TextInput
                  label="返回长度上限"
                  value={String(form.limit ?? 5000)}
                  onChange={(value) => setForm((prev) => ({ ...prev, limit: value }))}
                  type="number"
                />
                <SelectInput
                  label="检索模式"
                  value={String(form.searchMode || "semantic")}
                  onChange={(value) => setForm((prev) => ({ ...prev, searchMode: value }))}
                  options={[
                    { value: "semantic", label: "语义检索" },
                    { value: "hybrid", label: "混合检索" },
                    { value: "fullText", label: "全文检索" },
                  ]}
                />
              </div>
            </>
          )}

          {nodeType === "ifElseNode" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">分支条件</div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      ifElseList: [
                        ...(prev.ifElseList || []),
                        {
                          condition: "AND",
                          conditions: [{ variablePath: "", condition: "eq", value: "" }],
                        },
                      ],
                    }))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  新增分支
                </button>
              </div>
              {((form.ifElseList || []) as any[]).length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  还没有分支条件，新增后会自动生成对应的分支出口。
                </div>
              )}
              {(form.ifElseList || []).map((branch: any, branchIndex: number) => (
                <div key={branchIndex} className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-800">分支 {branchIndex + 1}</div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          ifElseList: (prev.ifElseList || []).filter(
                            (_: any, index: number) => index !== branchIndex
                          ),
                        }))
                      }
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      删除分支
                    </button>
                  </div>
                  <div className="mb-3">
                    <SelectInput
                      label="条件关系"
                      value={String(branch.condition || "AND")}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          ifElseList: (prev.ifElseList || []).map((item: any, index: number) =>
                            index === branchIndex ? { ...item, condition: value } : item
                          ),
                        }))
                      }
                      options={[
                        { value: "AND", label: "全部满足" },
                        { value: "OR", label: "满足任意一个" },
                      ]}
                    />
                  </div>
                  <div className="space-y-3">
                    {(branch.conditions || []).map((condition: any, conditionIndex: number) => (
                      <div key={conditionIndex} className="grid gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-[1.3fr,1fr,1fr,auto]">
                        <TextInput
                          label="变量路径"
                          value={String(condition.variablePath || pathToString(condition.variable))}
                          onChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              ifElseList: (prev.ifElseList || []).map((item: any, index: number) => {
                                if (index !== branchIndex) return item;
                                return {
                                  ...item,
                                  conditions: (item.conditions || []).map((row: any, rowIndex: number) =>
                                    rowIndex === conditionIndex
                                      ? { ...row, variablePath: value }
                                      : row
                                  ),
                                };
                              }),
                            }))
                          }
                          placeholder="例如 answerText"
                        />
                        <SelectInput
                          label="判断方式"
                          value={String(condition.condition || "eq")}
                          onChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              ifElseList: (prev.ifElseList || []).map((item: any, index: number) => {
                                if (index !== branchIndex) return item;
                                return {
                                  ...item,
                                  conditions: (item.conditions || []).map((row: any, rowIndex: number) =>
                                    rowIndex === conditionIndex ? { ...row, condition: value } : row
                                  ),
                                };
                              }),
                            }))
                          }
                          options={conditionOptions}
                        />
                        <TextInput
                          label="比较值"
                          value={String(condition.value || "")}
                          onChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              ifElseList: (prev.ifElseList || []).map((item: any, index: number) => {
                                if (index !== branchIndex) return item;
                                return {
                                  ...item,
                                  conditions: (item.conditions || []).map((row: any, rowIndex: number) =>
                                    rowIndex === conditionIndex ? { ...row, value } : row
                                  ),
                                };
                              }),
                            }))
                          }
                          placeholder="例如 yes"
                        />
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                ifElseList: (prev.ifElseList || []).map((item: any, index: number) => {
                                  if (index !== branchIndex) return item;
                                  return {
                                    ...item,
                                    conditions: (item.conditions || []).filter(
                                      (_: any, rowIndex: number) => rowIndex !== conditionIndex
                                    ),
                                  };
                                }),
                              }))
                            }
                            className="rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        ifElseList: (prev.ifElseList || []).map((item: any, index: number) =>
                          index === branchIndex
                            ? {
                                ...item,
                                conditions: [
                                  ...(item.conditions || []),
                                  { variablePath: "", condition: "eq", value: "" },
                                ],
                              }
                            : item
                        ),
                      }))
                    }
                    className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    新增条件
                  </button>
                </div>
              ))}
            </div>
          )}

          {nodeType === "httpRequest468" && (
            <>
              <div className="grid gap-4 md:grid-cols-[180px,1fr,160px]">
                <SelectInput
                  label="请求方法"
                  value={String(form.system_httpMethod || "GET")}
                  onChange={(value) => setForm((prev) => ({ ...prev, system_httpMethod: value, method: value }))}
                  options={[
                    { value: "GET", label: "GET" },
                    { value: "POST", label: "POST" },
                    { value: "PUT", label: "PUT" },
                    { value: "DELETE", label: "DELETE" },
                    { value: "PATCH", label: "PATCH" },
                  ]}
                />
                <TextInput
                  label="请求地址"
                  value={String(form.system_httpReqUrl || form.url || "")}
                  onChange={(value) => setForm((prev) => ({ ...prev, system_httpReqUrl: value, url: value }))}
                  placeholder="https://api.example.com/path"
                />
                <TextInput
                  label="超时秒数"
                  value={String(form.system_httpTimeout ?? 30)}
                  onChange={(value) => setForm((prev) => ({ ...prev, system_httpTimeout: value }))}
                  type="number"
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">请求头</div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        system_httpHeader: [...(prev.system_httpHeader || []), { key: "", value: "" }],
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    新增 Header
                  </button>
                </div>
                {(form.system_httpHeader || []).map((item: any, index: number) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
                    <TextInput
                      label="Key"
                      value={String(item.key || "")}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          system_httpHeader: (prev.system_httpHeader || []).map((row: any, rowIndex: number) =>
                            rowIndex === index ? { ...row, key: value } : row
                          ),
                        }))
                      }
                    />
                    <TextInput
                      label="Value"
                      value={String(item.value || "")}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          system_httpHeader: (prev.system_httpHeader || []).map((row: any, rowIndex: number) =>
                            rowIndex === index ? { ...row, value } : row
                          ),
                        }))
                      }
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            system_httpHeader: (prev.system_httpHeader || []).filter(
                              (_: any, rowIndex: number) => rowIndex !== index
                            ),
                          }))
                        }
                        className="rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <TextArea
                label="JSON Body"
                value={
                  typeof form.system_httpJsonBody === "string"
                    ? form.system_httpJsonBody
                    : JSON.stringify(form.system_httpJsonBody || "", null, 2)
                }
                onChange={(value) => setForm((prev) => ({ ...prev, system_httpJsonBody: value }))}
                placeholder='{"query":"{{userChatInput}}"}'
                rows={8}
              />
            </>
          )}

          {nodeType === "formInput" && (
            <div className="space-y-4">
              <TextArea
                label="说明文案"
                value={String(form.description || "")}
                onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                placeholder="告诉用户需要填写什么信息"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">表单字段</div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      userInputForms: [
                        ...(prev.userInputForms || []),
                        {
                          label: "",
                          key: "",
                          type: "input",
                          required: true,
                          description: "",
                          defaultValue: "",
                          optionsText: "",
                        },
                      ],
                    }))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  新增字段
                </button>
              </div>
              {(form.userInputForms || []).map((item: any, index: number) => (
                <div key={index} className="space-y-3 rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-800">字段 {index + 1}</div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          userInputForms: (prev.userInputForms || []).filter(
                            (_: any, rowIndex: number) => rowIndex !== index
                          ),
                        }))
                      }
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      删除
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextInput
                      label="字段名称"
                      value={String(item.label || "")}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          userInputForms: (prev.userInputForms || []).map((row: any, rowIndex: number) =>
                            rowIndex === index ? { ...row, label: value } : row
                          ),
                        }))
                      }
                      placeholder="例如 手机号"
                    />
                    <TextInput
                      label="字段 Key"
                      value={String(item.key || "")}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          userInputForms: (prev.userInputForms || []).map((row: any, rowIndex: number) =>
                            rowIndex === index ? { ...row, key: value } : row
                          ),
                        }))
                      }
                      placeholder="留空则自动生成"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectInput
                      label="字段类型"
                      value={String(item.type || "input")}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          userInputForms: (prev.userInputForms || []).map((row: any, rowIndex: number) =>
                            rowIndex === index ? { ...row, type: value } : row
                          ),
                        }))
                      }
                      options={formFieldTypes}
                    />
                    <label className="flex items-center gap-2 pt-7 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={!!item.required}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            userInputForms: (prev.userInputForms || []).map((row: any, rowIndex: number) =>
                              rowIndex === index ? { ...row, required: e.target.checked } : row
                            ),
                          }))
                        }
                      />
                      必填
                    </label>
                  </div>
                  <TextArea
                    label="字段说明"
                    value={String(item.description || "")}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        userInputForms: (prev.userInputForms || []).map((row: any, rowIndex: number) =>
                          rowIndex === index ? { ...row, description: value } : row
                        ),
                      }))
                    }
                    rows={2}
                  />
                  <TextInput
                    label="默认值"
                    value={String(item.defaultValue || "")}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        userInputForms: (prev.userInputForms || []).map((row: any, rowIndex: number) =>
                          rowIndex === index ? { ...row, defaultValue: value } : row
                        ),
                      }))
                    }
                  />
                  {item.type === "select" && (
                    <TextArea
                      label="选项"
                      value={String(item.optionsText || stringifyOptions(item.list))}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          userInputForms: (prev.userInputForms || []).map((row: any, rowIndex: number) =>
                            rowIndex === index ? { ...row, optionsText: value } : row
                          ),
                        }))
                      }
                      placeholder={"每行一个选项，支持 label:value\n例如\n高:high\n中:medium"}
                      rows={4}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {nodeType === "userSelect" && (
            <div className="space-y-4">
              <TextArea
                label="说明文案"
                value={String(form.description || "")}
                onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                placeholder="告诉用户如何选择"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">选项列表</div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      userSelectOptions: [...(prev.userSelectOptions || []), { key: "", value: "" }],
                    }))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  新增选项
                </button>
              </div>
              {(form.userSelectOptions || []).map((item: any, index: number) => (
                <div key={index} className="grid gap-3 rounded-xl border border-gray-200 p-4 md:grid-cols-[1fr,200px,auto]">
                  <TextInput
                    label="选项文案"
                    value={String(item.value || "")}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        userSelectOptions: (prev.userSelectOptions || []).map((row: any, rowIndex: number) =>
                          rowIndex === index ? { ...row, value } : row
                        ),
                      }))
                    }
                    placeholder="例如 售前咨询"
                  />
                  <TextInput
                    label="选项 Key"
                    value={String(item.key || "")}
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        userSelectOptions: (prev.userSelectOptions || []).map((row: any, rowIndex: number) =>
                          rowIndex === index ? { ...row, key: value } : row
                        ),
                      }))
                    }
                    placeholder="留空自动生成"
                  />
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          userSelectOptions: (prev.userSelectOptions || []).filter(
                            (_: any, rowIndex: number) => rowIndex !== index
                          ),
                        }))
                      }
                      className="rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {nodeType === "answerNode" && (
            <TextArea
              label="指定回复内容"
              value={String(form.answerText || "")}
              onChange={(value) => setForm((prev) => ({ ...prev, answerText: value }))}
              placeholder="支持使用 {{userChatInput}}、{{quoteQA}} 等变量"
              rows={8}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
