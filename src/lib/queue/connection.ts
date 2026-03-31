const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let IORedisModule: typeof import("ioredis") | null = null;

async function getIORedis() {
  if (!IORedisModule) {
    IORedisModule = await import(/* webpackIgnore: true */ "ioredis");
  }
  return IORedisModule.default;
}

let connection: import("ioredis").Redis | null = null;

export async function getRedisConnection(): Promise<import("ioredis").Redis> {
  if (!connection) {
    const IORedis = await getIORedis();
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export async function createRedisConnection(): Promise<import("ioredis").Redis> {
  const IORedis = await getIORedis();
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}
