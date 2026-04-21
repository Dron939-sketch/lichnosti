import IORedis from 'ioredis';

const globalForRedis = globalThis;

function buildRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set');
  }
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

export const redis = globalForRedis.__redis ?? buildRedis();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.__redis = redis;
}

export const bullConnection = { connection: redis };

export default redis;
