import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

if (!MONGODB_URI) {
  console.warn("[mongo] MONGODB_URI is not set, MongoDB features will be unavailable");
}

declare global {
  var mongooseConn: typeof mongoose | undefined;
}

function getMongoClient() {
  if (!global.mongooseConn) {
    global.mongooseConn = mongoose;
  }
  return global.mongooseConn;
}

const mongo = getMongoClient();

let connectPromise: Promise<typeof mongoose> | null = null;

export async function connectMongo(): Promise<typeof mongoose> {
  if (mongo.connection.readyState === 1) {
    return mongo;
  }
  if (!connectPromise) {
    connectPromise = mongo.connect(MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }).then((conn) => {
      console.log("[mongo] connected");
      return conn;
    }).catch((err) => {
      connectPromise = null;
      console.error("[mongo] connection failed:", err);
      throw err;
    });
  }
  return connectPromise;
}

export { mongo };
export const { Schema, Types, model, models } = mongo;
export default mongo;
