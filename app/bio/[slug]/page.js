import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { buildPersonSchema, buildBreadcrumbSchema } from '@/lib/seo/schema-builder';
import { REVALIDATE_SECONDS, SITE_URL, SITE_NAME } from '@/lib/utils/constants';
import { defaultMeta } from '@/lib/seo/meta-generator';

export const revalidate = REVALIDATE_SECONDS.bio;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const persons = await db.person.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true },
      take: 500
    });
    return persons.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

async function getPerson(slug) {
  try {
    return await db.person.findUnique({
      where: { slug },
      include: {
        categories: { include: { category: true } }
      }
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const person = await getPerson(params.slug);
  if (!person) return { title: 'Не найдено' };
  const base = defaultMeta(person);
  return {
    title: person.seo_title || base.title,
    description: person.seo_desc || base.description,
    keywords: person.seo_keywords || base.keywords,
    alternates: { canonical: `${SITE_URL}/bio/${person.slug}` },
    openGraph: {
      type: 'article',
      title: person.seo_title || base.title,
      description: person.seo_desc || base.description,
      url: `${SITE_URL}/bio/${person.slug}`,
      images: person.photo_url ? [{ url: person.photo_url }] : []
    }
  };
}

export default async function BioPage({ params }) {
  const person = await getPerson(params.slug);
  if (!person) notFound();

  const personSchema = buildPersonSchema(person);
  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Главная', url: SITE_URL },
    { name: person.name, url: `${SITE_URL}/bio/${person.slug}` }
  ]);

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : null);

  return (
    <article className="bio-article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">Главная</Link>
        <span className="sep">›</span>
        <span>{person.name}</span>
      </nav>

      <header className="bio-header">
        <div
          className="bio-photo"
          style={person.photo_url ? { backgroundImage: `url(${person.photo_url})` } : undefined}
          role="img"
          aria-label={person.name}
        />
        <div className="bio-title">
          <h1>{person.name}</h1>
          <ul className="bio-facts">
            {person.profession && <li><strong>Профессия:</strong> {person.profession}</li>}
            {person.birth_date && <li><strong>Дата рождения:</strong> {formatDate(person.birth_date)}</li>}
            {person.death_date && <li><strong>Дата смерти:</strong> {formatDate(person.death_date)}</li>}
            {person.birth_place && <li><strong>Место рождения:</strong> {person.birth_place}</li>}
            {person.zodiac && <li><strong>Знак зодиака:</strong> {person.zodiac}</li>}
          </ul>
        </div>
      </header>

      <div
        className="bio-content"
        dangerouslySetInnerHTML={{ __html: person.bio_full }}
      />

      <div style={{ marginTop: 40, fontSize: 13, color: '#777', fontFamily: 'sans-serif' }}>
        Обновлено: {formatDate(person.updated_at)} · {SITE_NAME}
      </div>
    </article>
  );
}
