import { redis } from '../redis.js';
import crypto from 'node:crypto';

export function cacheKey(promptKey, payload) {
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16);
  return `deepseek:${promptKey}:${hash}`;
}

export async function getCached(key) {
  const v = await redis.get(key);
  return v ? JSON.parse(v) : null;
}

export async function setCached(key, value, ttlSeconds = 60 * 60 * 24 * 7) {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}
