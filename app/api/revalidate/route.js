import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body = {};
  try { body = await request.json(); } catch {}
  const { slug, type = 'person' } = body;

  const revalidated = [];
  if (type === 'person' && slug) {
    revalidatePath(`/bio/${slug}`);
    revalidated.push(`/bio/${slug}`);
  } else if (type === 'category' && slug) {
    revalidatePath(`/category/${slug}`);
    revalidated.push(`/category/${slug}`);
  }
  revalidatePath('/');
  revalidatePath('/sitemap.xml');
  revalidated.push('/', '/sitemap.xml');

  return NextResponse.json({ revalidated, at: Date.now() });
}
