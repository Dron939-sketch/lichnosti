import Link from 'next/link';
import { db } from '@/lib/db';
import { REVALIDATE_SECONDS, SITE_NAME } from '@/lib/utils/constants';

export const revalidate = REVALIDATE_SECONDS.home;

export default async function HomePage() {
  let latest = [];
  let popular = [];
  try {
    [latest, popular] = await Promise.all([
      db.person.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { created_at: 'desc' },
        take: 12,
        select: { slug: true, name: true, bio_short: true, photo_url: true, profession: true }
      }),
      db.person.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { views: 'desc' },
        take: 8,
        select: { slug: true, name: true, bio_short: true, photo_url: true, profession: true }
      })
    ]);
  } catch (e) {
    console.warn('DB not ready on home page:', e.message);
  }

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>{SITE_NAME}</h1>
          <p>Биографии известных людей: актёры, политики, учёные, спортсмены, деятели искусства. Обновляется ежедневно.</p>
        </div>
      </section>

      <section className="container">
        <h2 style={{ marginTop: 40, fontFamily: 'Playfair Display, Georgia, serif' }}>Новые биографии</h2>
        <div className="grid">
          {latest.map((p) => <PersonCard key={p.slug} p={p} />)}
          {latest.length === 0 && <EmptyState />}
        </div>

        {popular.length > 0 && (
          <>
            <h2 style={{ marginTop: 40, fontFamily: 'Playfair Display, Georgia, serif' }}>Популярное</h2>
            <div className="grid">
              {popular.map((p) => <PersonCard key={p.slug} p={p} />)}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function PersonCard({ p }) {
  return (
    <Link href={`/bio/${p.slug}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        className="card-photo"
        style={p.photo_url ? { backgroundImage: `url(${p.photo_url})` } : undefined}
      />
      <div className="card-body">
        <h3 className="card-name">{p.name}</h3>
        <div className="card-meta">{p.profession || 'биография'}</div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#777' }}>
      <p>Биографии ещё не сгенерированы. Запустите <code>npm run seed</code> или cron-задачу <code>/api/cron/generate-daily</code>.</p>
    </div>
  );
}
