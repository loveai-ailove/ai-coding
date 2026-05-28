import { Client as MinioClient } from "minio";

const STORAGE_VENDOR = process.env.STORAGE_VENDOR || "minio";
const STORAGE_S3_ENDPOINT = process.env.STORAGE_S3_ENDPOINT || "http://localhost:9000";
const STORAGE_ACCESS_KEY_ID = process.env.STORAGE_ACCESS_KEY_ID || "minioadmin";
const STORAGE_SECRET_ACCESS_KEY = process.env.STORAGE_SECRET_ACCESS_KEY || "minioadmin";
const STORAGE_PUBLIC_BUCKET = process.env.STORAGE_PUBLIC_BUCKET || "fastgpt-public";
const STORAGE_PRIVATE_BUCKET = process.env.STORAGE_PRIVATE_BUCKET || "fastgpt-private";
const STORAGE_REGION = process.env.STORAGE_REGION || "us-east-1";

declare global {
  var minioClient: MinioClient | undefined;
}

function parseEndpoint(endpoint: string): { host: string; port: number; useSSL: boolean } {
  const url = new URL(endpoint);
  return {
    host: url.hostname,
    port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
    useSSL: url.protocol === "https:",
  };
}

function createMinioClient(): MinioClient {
  if (global.minioClient) return global.minioClient;
  const { host, port, useSSL } = parseEndpoint(STORAGE_S3_ENDPOINT);
  const client = new MinioClient({
    endPoint: host,
    port,
    useSSL,
    accessKey: STORAGE_ACCESS_KEY_ID,
    secretKey: STORAGE_SECRET_ACCESS_KEY,
    region: STORAGE_REGION,
    pathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === "true",
  });
  global.minioClient = client;
  return client;
}

export const minioClient = createMinioClient();

export { STORAGE_PUBLIC_BUCKET, STORAGE_PRIVATE_BUCKET };

export async function ensureBuckets() {
  for (const bucket of [STORAGE_PUBLIC_BUCKET, STORAGE_PRIVATE_BUCKET]) {
    const exists = await minioClient.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await minioClient.makeBucket(bucket, STORAGE_REGION);
      if (bucket === STORAGE_PUBLIC_BUCKET) {
        const policy = JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        });
        await minioClient.setBucketPolicy(bucket, policy);
      }
    }
  }
}

export function getPublicUrl(key: string): string {
  const externalEndpoint = process.env.STORAGE_EXTERNAL_ENDPOINT || STORAGE_S3_ENDPOINT;
  return `${externalEndpoint}/${STORAGE_PUBLIC_BUCKET}/${key}`;
}

export function getPrivateUrl(key: string): string {
  const externalEndpoint = process.env.STORAGE_EXTERNAL_ENDPOINT || STORAGE_S3_ENDPOINT;
  return `${externalEndpoint}/${STORAGE_PRIVATE_BUCKET}/${key}`;
}
