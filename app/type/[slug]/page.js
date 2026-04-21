import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { REVALIDATE_SECONDS, SITE_URL, SITE_NAME } from '@/lib/utils/constants';
import { buildBreadcrumbSchema } from '@/lib/seo/schema-builder';

export const revalidate = REVALIDATE_SECONDS.category;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const cats = await db.category.findMany({ select: { slug: true }, take: 100 });
    return cats.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

async function getCategory(slug) {
  try {
    return await db.category.findUnique({
      where: { slug },
      include: {
        persons: {
          include: { person: { select: { id: true, slug: true, name: true, bio_short: true, photo_url: true, profession: true } } },
          take: 60
        }
      }
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const cat = await getCategory(params.slug);
  if (!cat) return { title: 'Категория не найдена' };
  return {
    title: cat.seo_title || `${cat.name} — биографии`,
    description: cat.seo_desc || `Биографии: ${cat.name}. Подборка на ${SITE_NAME}.`,
    alternates: { canonical: `${SITE_URL}/type/${cat.slug}` }
  };
}

export default async function CategoryPage({ params }) {
  const cat = await getCategory(params.slug);
  if (!cat) notFound();

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Главная страница', url: SITE_URL },
    { name: cat.name, url: `${SITE_URL}/type/${cat.slug}` }
  ]);

  return (
    <section className="container" style={{ padding: '24px 20px 40px' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">Главная</Link>
        <span className="sep">›</span>
        <span>{cat.name}</span>
      </nav>

      <h1 className="author_title" style={{ marginBottom: 6 }}>{cat.name}</h1>
      {cat.description && <p className="was">{cat.description}</p>}

      <div className="grid" style={{ marginTop: 20 }}>
        {cat.persons.map(({ person: p }) => (
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
        {cat.persons.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#777' }}>
            В этой категории пока нет биографий.
          </div>
        )}
      </div>
    </section>
  );
}
