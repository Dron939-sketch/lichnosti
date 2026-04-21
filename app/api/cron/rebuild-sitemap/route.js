import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidatePath('/sitemap.xml');
  revalidatePath('/');

  if (process.env.INDEXNOW_KEY && process.env.NEXT_PUBLIC_URL) {
    try {
      await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: new URL(process.env.NEXT_PUBLIC_URL).host,
          key: process.env.INDEXNOW_KEY,
          urlList: [`${process.env.NEXT_PUBLIC_URL}/sitemap.xml`]
        })
      });
    } catch (e) {
      console.warn('IndexNow ping failed:', e.message);
    }
  }

  return NextResponse.json({ ok: true, at: Date.now() });
}

export const POST = GET;
