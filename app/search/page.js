import Link from 'next/link';
import { db } from '@/lib/db';
import { SITE_URL, SITE_NAME } from '@/lib/utils/constants';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

export async function generateMetadata({ searchParams }) {
  const q = (searchParams?.s || '').trim();
  return {
    title: q ? `Поиск: ${q}` : 'Поиск биографий',
    description: q
      ? `Результаты поиска "${q}" на ${SITE_NAME}`
      : `Найдите биографию на портале ${SITE_NAME}.`,
    alternates: { canonical: q ? `${SITE_URL}/search?s=${encodeURIComponent(q)}` : `${SITE_URL}/search` },
    robots: { index: !q, follow: true }
  };
}

async function search(q, page = 1) {
  if (!q || q.length < 2) return { items: [], total: 0 };
  const skip = (page - 1) * PAGE_SIZE;
  const where = {
    status: 'PUBLISHED',
    OR: [
      { name:        { contains: q, mode: 'insensitive' } },
      { profession:  { contains: q, mode: 'insensitive' } },
      { bio_short:   { contains: q, mode: 'insensitive' } },
      { birth_place: { contains: q, mode: 'insensitive' } }
    ]
  };
  try {
    const [items, total] = await Promise.all([
      db.person.findMany({
        where,
        orderBy: [{ views: 'desc' }, { name: 'asc' }],
        skip,
        take: PAGE_SIZE,
        select: { slug: true, name: true, bio_short: true, photo_url: true, profession: true }
      }),
      db.person.count({ where })
    ]);
    return { items, total };
  } catch (e) {
    console.warn('search failed:', e.message);
    return { items: [], total: 0 };
  }
}

export default async function SearchPage({ searchParams }) {
  const q = (searchParams?.s || '').trim();
  const page = Math.max(1, Number(searchParams?.page || 1));
  const { items, total } = await search(q, page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="container" style={{ padding: '24px 20px 60px' }}>
      <h1 className="author_title" style={{ marginBottom: 6 }}>
        {q ? `Поиск: «${q}»` : 'Поиск биографий'}
      </h1>
      <p className="was">
        {q ? `Найдено: ${total}` : 'Введите имя, профессию или место рождения в форме в шапке.'}
      </p>

      <form action="/search" method="GET" style={{ marginTop: 18, maxWidth: 560 }}>
        <input
          type="text"
          name="s"
          defaultValue={q}
          placeholder="Чью биографию изучим?"
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: 16,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            outline: 'none'
          }}
        />
      </form>

      {items.length > 0 && (
        <div className="grid" style={{ marginTop: 22 }}>
          {items.map((p) => (
            <Link key={p.slug} href={`/bio/${p.slug}`} className="card">
              <div
                className="card-photo"
                style={p.photo_url ? { backgroundImage: `url(${p.photo_url})` } : undefined}
              />
              <div className="card-body">
                <h3 className="card-name">{p.name}</h3>
                <div className="card-meta">{p.profession || 'биография'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {q && items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          Ничего не найдено. Попробуйте другой запрос.
        </div>
      )}

      {pages > 1 && (
        <nav style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 30 }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/search?s=${encodeURIComponent(q)}&page=${n}`}
              className={n === page ? 'btn' : 'btn btn_small'}
              style={{ padding: '6px 12px' }}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
