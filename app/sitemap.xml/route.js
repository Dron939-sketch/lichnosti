import { db } from '@/lib/db';
import { SITE_URL, REVALIDATE_SECONDS } from '@/lib/utils/constants';

export const revalidate = REVALIDATE_SECONDS.sitemap;

function urlEntry({ loc, lastmod, changefreq = 'weekly', priority = 0.7 }) {
  return `<url><loc>${loc}</loc>${
    lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''
  }<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export async function GET() {
  let persons = [];
  let categories = [];
  try {
    [persons, categories] = await Promise.all([
      db.person.findMany({
        where: { status: 'PUBLISHED' },
        select: { slug: true, updated_at: true },
        orderBy: { updated_at: 'desc' },
        take: 50_000
      }),
      db.category.findMany({ select: { slug: true, updated_at: true } })
    ]);
  } catch (e) {
    console.warn('sitemap: db error', e.message);
  }

  const entries = [
    urlEntry({ loc: `${SITE_URL}/`, changefreq: 'daily', priority: 1.0 }),
    ...categories.map((c) =>
      urlEntry({
        loc: `${SITE_URL}/type/${c.slug}`,
        lastmod: c.updated_at,
        changefreq: 'daily',
        priority: 0.8
      })
    ),
    ...persons.map((p) =>
      urlEntry({
        loc: `${SITE_URL}/bio/${p.slug}`,
        lastmod: p.updated_at,
        changefreq: 'weekly',
        priority: 0.7
      })
    )
  ].join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate'
    }
  });
}
