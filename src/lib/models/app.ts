import { mongo, Schema, connectMongo } from "@/lib/infra/mongo";
import type { Schema as MongooseSchema, Types } from "mongoose";

function getFreshModel(name: string, schema: MongooseSchema) {
  if (process.env.NODE_ENV !== "production" && mongo.models[name]) {
    mongo.deleteModel(name);
  }

  return mongo.models[name] || mongo.model(name, schema);
}

const AppSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: "App", default: null },
    name: { type: String, required: true },
    type: { type: String, enum: ["workflow", "folder"], default: "workflow" },
    avatar: { type: String, default: "/icon/logo.svg" },
    intro: { type: String, default: "" },
    updateTime: { type: Date, default: () => new Date() },
    modules: { type: Schema.Types.Mixed, default: [] },
    edges: { type: Schema.Types.Mixed, default: [] },
    chatConfig: {
      type: {
        welcomeText: String,
        variables: { type: Schema.Types.Mixed, default: [] },
        questionGuide: { type: Schema.Types.Mixed },
        fileSelectConfig: { type: Schema.Types.Mixed },
        instruction: String,
      },
      default: {},
    },
    deleteTime: { type: Date, default: null },
  },
  { minimize: false }
);

AppSchema.index({ userId: 1, updateTime: -1 });
AppSchema.index({ userId: 1, type: 1 });
AppSchema.index({ deleteTime: 1 });

const WorkflowVersionSchema = new Schema({
  appId: { type: Schema.Types.ObjectId, required: true, index: true },
  userId: { type: String, required: true },
  versionName: { type: String, required: true },
  modules: { type: Schema.Types.Mixed, default: [] },
  edges: { type: Schema.Types.Mixed, default: [] },
  chatConfig: { type: Schema.Types.Mixed, default: {} },
  createTime: { type: Date, default: () => new Date() },
  publishTime: { type: Date, default: () => new Date() },
});

WorkflowVersionSchema.index({ appId: 1, publishTime: -1 });

const ChatSchema = new Schema({
  appId: { type: Schema.Types.ObjectId, required: true, index: true },
  userId: { type: String, required: true },
  title: { type: String, default: "New Chat" },
  updateTime: { type: Date, default: () => new Date() },
  source: { type: String, enum: ["test", "api", "share"], default: "test" },
});

ChatSchema.index({ userId: 1, appId: 1, updateTime: -1 });

const ChatItemSchema = new Schema({
  chatId: { type: Schema.Types.ObjectId, required: true, index: true },
  userId: { type: String, required: true },
  appId: { type: Schema.Types.ObjectId, required: true },
  obj: { type: String, enum: ["Human", "AI", "SYSTEM"], required: true },
  value: { type: Schema.Types.Mixed, required: true },
  responseData: { type: Schema.Types.Mixed },
  time: { type: Date, default: () => new Date() },
});

ChatItemSchema.index({ chatId: 1, time: 1 });

export async function getAppModel() {
  await connectMongo();
  return getFreshModel("App", AppSchema);
}

export async function getWorkflowVersionModel() {
  await connectMongo();
  return getFreshModel("WorkflowVersion", WorkflowVersionSchema);
}

export async function getChatModel() {
  await connectMongo();
  return getFreshModel("Chat", ChatSchema);
}

export async function getChatItemModel() {
  await connectMongo();
  return getFreshModel("ChatItem", ChatItemSchema);
}

export interface AppDoc {
  _id: Types.ObjectId;
  userId: string;
  parentId?: Types.ObjectId | null;
  name: string;
  type: "workflow" | "folder";
  avatar: string;
  intro: string;
  updateTime: Date;
  modules: any[];
  edges: any[];
  chatConfig: Record<string, any>;
  deleteTime: Date | null;
}

export interface WorkflowVersionDoc {
  _id: Types.ObjectId;
  appId: Types.ObjectId;
  userId: string;
  versionName: string;
  modules: any[];
  edges: any[];
  chatConfig: Record<string, any>;
  createTime: Date;
  publishTime: Date;
}
