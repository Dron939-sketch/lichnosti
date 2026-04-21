import { db } from '../db/index.js';
import { generationQueue } from '../ai/queue.js';

export async function enqueueDailyGeneration({ limit = 3 } = {}) {
  const candidates = await db.trendCandidate.findMany({
    where: { processed: false },
    orderBy: { score: 'desc' },
    take: limit
  });

  if (candidates.length === 0) return { queued: 0, candidates: [] };

  const jobs = [];
  for (const c of candidates) {
    const job = await generationQueue.add('generate', {
      name: c.name,
      category: c.source,
      context: null
    });
    jobs.push({ id: job.id, name: c.name });
    await db.trendCandidate.update({
      where: { id: c.id },
      data: { processed: true }
    });
  }
  return { queued: jobs.length, candidates: jobs };
}

export async function enqueueStaleUpdates({ days = 90, limit = 5 } = {}) {
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const stale = await db.person.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [
        { last_ai_check: null },
        { last_ai_check: { lt: threshold } }
      ]
    },
    orderBy: { updated_at: 'asc' },
    take: limit
  });

  const jobs = [];
  for (const p of stale) {
    const job = await generationQueue.add('update', {
      personId: p.id,
      newFacts: []
    });
    jobs.push({ id: job.id, slug: p.slug });
  }
  return { queued: jobs.length, jobs };
}
