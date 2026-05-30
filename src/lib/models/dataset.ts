import { mongo, Schema, connectMongo } from "@/lib/infra/mongo";
import type { Schema as MongooseSchema, Types } from "mongoose";

function getFreshModel(name: string, schema: MongooseSchema) {
  if (process.env.NODE_ENV !== "production" && mongo.models[name]) {
    mongo.deleteModel(name);
  }

  return mongo.models[name] || mongo.model(name, schema);
}

const DatasetSchema = new Schema({
  userId: { type: String, required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, ref: "Dataset", default: null },
  type: { type: String, enum: ["dataset", "folder"], default: "dataset" },
  avatar: { type: String, default: "/icon/logo.svg" },
  name: { type: String, required: true },
  intro: { type: String, default: "" },
  embeddingModelId: { type: String, default: "" },
  embeddingModelName: { type: String, default: "" },
  embeddingDimension: { type: Number },
  llmModelId: { type: String, default: "" },
  llmModelName: { type: String, default: "" },
  vectorModel: { type: String, default: process.env.DEFAULT_EMBEDDING_MODEL || "text-embedding-3-small" },
  agentModel: { type: String, default: process.env.DEFAULT_LLM_MODEL || "qwen-max" },
  updateTime: { type: Date, default: () => new Date() },
  chunkSize: { type: Number, default: 512 },
  chunkSplitter: { type: String, default: "" },
  qaPrompt: { type: String, default: "" },
  deleteTime: { type: Date, default: null },
});

DatasetSchema.index({ userId: 1, updateTime: -1 });
DatasetSchema.index({ userId: 1, parentId: 1 });
DatasetSchema.index({ deleteTime: 1 });

const DatasetCollectionSchema = new Schema({
  userId: { type: String, required: true, index: true },
  datasetId: { type: Schema.Types.ObjectId, required: true, index: true },
  parentId: { type: Schema.Types.ObjectId, ref: "DatasetCollection", default: null },
  type: {
    type: String,
    enum: ["file", "text", "link", "folder"],
    required: true,
  },
  name: { type: String, required: true },
  tags: { type: [String], default: [] },
  fileId: { type: String },
  fileKey: { type: String },
  fileUrl: { type: String },
  fileExt: { type: String },
  fileSize: { type: Number },
  mimeType: { type: String },
  rawLink: { type: String },
  rawTextLength: { type: Number },
  hashRawText: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  chunkSize: { type: Number },
  chunkSplitter: { type: String },
  createTime: { type: Date, default: () => new Date() },
  updateTime: { type: Date, default: () => new Date() },
  forbid: { type: Boolean, default: false },
  deleteTime: { type: Date, default: null },
});

DatasetCollectionSchema.index({ userId: 1, datasetId: 1, parentId: 1, updateTime: -1 });
DatasetCollectionSchema.index({ userId: 1, datasetId: 1, tags: 1 });

const DatasetDataSchema = new Schema({
  userId: { type: String, required: true, index: true },
  datasetId: { type: Schema.Types.ObjectId, required: true },
  collectionId: { type: Schema.Types.ObjectId, required: true },
  q: { type: String, required: true },
  a: { type: String },
  indexes: {
    type: [
      {
        type: { type: String, enum: ["custom", "summary"], default: "custom" },
        dataId: { type: String, required: true },
        text: { type: String, required: true },
      },
    ],
    default: [],
  },
  updateTime: { type: Date, default: () => new Date() },
  chunkIndex: { type: Number, default: 0 },
});

DatasetDataSchema.index({ userId: 1, datasetId: 1, collectionId: 1, chunkIndex: 1, updateTime: -1 });
DatasetDataSchema.index({ userId: 1, datasetId: 1, collectionId: 1, "indexes.dataId": 1 });

const DatasetTrainingSchema = new Schema({
  userId: { type: String, required: true },
  datasetId: { type: Schema.Types.ObjectId, required: true },
  collectionId: { type: Schema.Types.ObjectId, required: true },
  dataId: { type: Schema.Types.ObjectId },
  mode: { type: String, enum: ["chunk", "qa"], default: "chunk" },
  model: { type: String },
  prompt: { type: String },
  q: { type: String },
  a: { type: String },
  retryCount: { type: Number, default: 0 },
  lockTime: { type: Date },
  errorMsg: { type: String },
  createTime: { type: Date, default: () => new Date() },
});

DatasetTrainingSchema.index({ userId: 1, datasetId: 1, collectionId: 1 });
DatasetTrainingSchema.index({ lockTime: 1 });

export async function getDatasetModel() {
  await connectMongo();
  return getFreshModel("Dataset", DatasetSchema);
}

export async function getDatasetCollectionModel() {
  await connectMongo();
  return getFreshModel("DatasetCollection", DatasetCollectionSchema);
}

export async function getDatasetDataModel() {
  await connectMongo();
  return getFreshModel("DatasetData", DatasetDataSchema);
}

export async function getDatasetTrainingModel() {
  await connectMongo();
  return getFreshModel("DatasetTraining", DatasetTrainingSchema);
}

export interface DatasetDoc {
  _id: Types.ObjectId;
  userId: string;
  parentId?: Types.ObjectId | null;
  type: "dataset" | "folder";
  avatar: string;
  name: string;
  intro: string;
  embeddingModelId: string;
  embeddingModelName: string;
  embeddingDimension?: number;
  llmModelId: string;
  llmModelName: string;
  vectorModel: string;
  agentModel: string;
  updateTime: Date;
  chunkSize: number;
  chunkSplitter: string;
  qaPrompt: string;
  deleteTime: Date | null;
}

export interface DatasetCollectionDoc {
  _id: Types.ObjectId;
  userId: string;
  datasetId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  type: "file" | "text" | "link" | "folder";
  name: string;
  tags: string[];
  fileId?: string;
  fileKey?: string;
  fileUrl?: string;
  fileExt?: string;
  fileSize?: number;
  mimeType?: string;
  rawLink?: string;
  rawTextLength?: number;
  hashRawText?: string;
  metadata: Record<string, any>;
  chunkSize?: number;
  chunkSplitter?: string;
  createTime: Date;
  updateTime: Date;
  forbid: boolean;
  deleteTime: Date | null;
}

export interface DatasetDataDoc {
  _id: Types.ObjectId;
  userId: string;
  datasetId: Types.ObjectId;
  collectionId: Types.ObjectId;
  q: string;
  a?: string;
  indexes: Array<{ type: string; dataId: string; text: string }>;
  updateTime: Date;
  chunkIndex: number;
}
