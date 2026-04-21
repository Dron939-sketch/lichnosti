import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const signature = request.headers.get('x-webhook-signature');
  if (!signature || signature !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload = null;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { job_id, status, result, error, usage } = payload || {};
  if (!job_id) {
    return NextResponse.json({ error: 'job_id required' }, { status: 400 });
  }

  await db.generationLog.update({
    where: { job_id: String(job_id) },
    data: {
      status: status === 'success' ? 'DONE' : 'FAILED',
      error: error || null,
      tokens_in: usage?.prompt_tokens || 0,
      tokens_out: usage?.completion_tokens || 0,
      finished_at: new Date()
    }
  }).catch(() => {});

  return NextResponse.json({ ok: true, result });
}
