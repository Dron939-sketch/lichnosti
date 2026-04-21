import { NextResponse } from 'next/server';
import { enqueueDailyGeneration } from '@/lib/scheduler/cron-jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return unauthorized();

  const url = new URL(request.url);
  const limit = Math.min(10, Number(url.searchParams.get('limit') || 3));

  const result = await enqueueDailyGeneration({ limit });
  return NextResponse.json(result);
}

export const POST = GET;
