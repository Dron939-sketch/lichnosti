import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/status  (Bearer CRON_SECRET)
 * Простой дашборд для free-tier: сколько записей в БД.
 */
export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const out = { at: new Date().toISOString() };

  try {
    const [persons, categories, generationLogs, trendCandidates] = await Promise.all([
      db.person.count(),
      db.category.count(),
      db.generationLog.count(),
      db.trendCandidate.count()
    ]);
    out.persons = persons;
    out.categories = categories;
    out.generation_logs = generationLogs;
    out.trend_candidates = trendCandidates;
  } catch (e) {
    out.db_error = String(e?.message || e);
  }

  if (out.persons > 0) {
    try {
      const sample = await db.person.findMany({
        select: { slug: true, name: true, status: true },
        orderBy: { created_at: 'desc' },
        take: 5
      });
      out.recent = sample;
    } catch (e) { /* ignore */ }
  }

  return NextResponse.json(out);
}
