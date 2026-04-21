import axios from 'axios';
import { buildPrompt } from './prompts.js';
import { throttle } from './rate-limiter.js';
import { cacheKey, getCached, setCached } from './cache.js';

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const API_KEY = process.env.DEEPSEEK_API_KEY;

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY || ''}`
  }
});

function parseJsonLoose(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* noop */ }
    }
    return null;
  }
}

export async function deepseekRaw(messages, { temperature = 0.7, maxTokens = 4000 } = {}) {
  if (!API_KEY) throw new Error('DEEPSEEK_API_KEY is not set');
  await throttle(1);

  const { data } = await client.post('/chat/completions', {
    model: MODEL,
    messages,
    temperature,
    max_tokens: maxTokens
  });

  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? '';
  const usage = data?.usage || { prompt_tokens: 0, completion_tokens: 0 };

  return { content, usage, model: data?.model || MODEL };
}

export async function deepseekGenerate(promptKey, vars, opts = {}) {
  const { noCache = false, ttl = 60 * 60 * 24 * 7, temperature, maxTokens } = opts;
  const key = cacheKey(promptKey, { promptKey, vars });

  if (!noCache) {
    const hit = await getCached(key);
    if (hit) return { ...hit, cached: true };
  }

  const { system, user } = buildPrompt(promptKey, vars);
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  const { content, usage, model } = await deepseekRaw(messages, { temperature, maxTokens });

  const jsonPrompts = new Set([
    'full_bio',
    'seo_meta',
    'similar_persons',
    'has_new_info',
    'fact_check',
    'validate_russian'
  ]);
  const parsed = jsonPrompts.has(promptKey) ? parseJsonLoose(content) : null;

  const result = {
    text: content,
    data: parsed,
    usage,
    model,
    cached: false
  };

  if (!noCache) await setCached(key, result, ttl);
  return result;
}

export default { deepseekGenerate, deepseekRaw };
