import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "";

if (!REDIS_URL) {
  console.warn("[redis] REDIS_URL is not set, Redis features will be unavailable");
}

declare global {
  var redisClient: Redis | undefined;
}

function createRedisClient(): Redis {
  if (global.redisClient) {
    return global.redisClient;
  }
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });
  client.on("connect", () => console.log("[redis] connected"));
  client.on("error", (err) => console.error("[redis] error:", err.message));
  global.redisClient = client;
  return client;
}

export const redis = createRedisClient();

export async function connectRedis() {
  if (redis.status === "ready") return;
  if (redis.status === "wait") {
    await redis.connect();
  }
}

export async function getCache(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    if (ttlSeconds) {
      await redis.set(key, value, "EX", ttlSeconds);
    } else {
      await redis.set(key, value);
    }
  } catch (err) {
    console.error("[redis] setCache error:", err);
  }
}

export async function delCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("[redis] delCache error:", err);
  }
}
