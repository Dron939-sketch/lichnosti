import { NextResponse } from 'next/server';
import { enqueueStaleUpdates } from '@/lib/scheduler/cron-jobs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get('days') || 90);
  const limit = Math.min(20, Number(url.searchParams.get('limit') || 5));

  const result = await enqueueStaleUpdates({ days, limit });
  return NextResponse.json(result);
}

export const POST = GET;
