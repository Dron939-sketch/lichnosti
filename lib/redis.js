import IORedis from 'ioredis';

const globalForRedis = globalThis;

function buildRedis() {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  if (!process.env.REDIS_URL) {
    console.warn('[redis] REDIS_URL is not set, using localhost fallback (safe for build, will fail at runtime)');
  }
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true
  });
}

export const redis = globalForRedis.__redis ?? buildRedis();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.__redis = redis;
}

export const bullConnection = { connection: redis };

export default redis;
