import { NextResponse } from 'next/server';
import { runCollectAndSave } from '@/lib/sources/aggregator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runCollectAndSave();
  return NextResponse.json(result);
}

export const POST = GET;
