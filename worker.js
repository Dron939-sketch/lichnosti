import 'dotenv/config';
import { createWorker } from './lib/ai/queue.js';
import { db } from './lib/db/index.js';

console.log('[worker] starting bio-generation worker...');

const worker = createWorker();

worker.on('ready',     ()           => console.log('[worker] ready'));
worker.on('active',    (job)        => console.log('[worker] active job', job.id, job.name, job.data?.name || ''));
worker.on('completed', (job, res)   => console.log('[worker] done', job.id, res?.slug || ''));
worker.on('failed',    (job, err)   => console.error('[worker] failed', job?.id, err?.message));
worker.on('error',     (err)        => console.error('[worker] error', err?.message));

async function shutdown(signal) {
  console.log(`[worker] shutting down on ${signal}`);
  try { await worker.close(); } catch {}
  try { await db.$disconnect(); } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
