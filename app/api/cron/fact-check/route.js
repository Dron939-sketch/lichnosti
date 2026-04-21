import { NextResponse } from 'next/server';
import { pickPersonsForFactCheck, factCheckPerson } from '@/lib/factcheck/compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = Math.min(20, Number(url.searchParams.get('limit') || 5));
  const olderThanDays = Number(url.searchParams.get('days') || 30);

  const targets = await pickPersonsForFactCheck({ limit, olderThanDays });
  const results = [];

  for (const p of targets) {
    try {
      const r = await factCheckPerson(p.id);
      results.push({ slug: p.slug, name: p.name, ok: r.ok, issues: r.issues, error: r.error });
    } catch (e) {
      results.push({ slug: p.slug, name: p.name, error: String(e?.message || e) });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}

export const POST = GET;
