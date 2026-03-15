import { S3Client } from "@aws-sdk/client-s3";
import { readR2Env } from "@/lib/r2/env";

let cached: { client: S3Client; bucket: string } | null = null;

export function getR2Client() {
  if (cached) {
    return cached;
  }

  const env = readR2Env();
  if (!env.ok) {
    throw new Error(env.message);
  }

  const endpoint = `https://${env.value.accountId}.r2.cloudflarestorage.com`;

  const client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.value.accessKeyId,
      secretAccessKey: env.value.secretAccessKey,
    },
  });

  cached = { client, bucket: env.value.bucket };
  return cached;
}

