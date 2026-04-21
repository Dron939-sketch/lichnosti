import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = { database: false, redis: false };
  try { await db.$queryRaw`SELECT 1`; checks.database = true; } catch (_) {}
  try { await redis.ping(); checks.redis = true; } catch (_) {}

  const healthy = checks.database && checks.redis;
  return NextResponse.json(
    { status: healthy ? 'healthy' : 'degraded', checks, time: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
