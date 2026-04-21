import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { buildPersonSchema, buildBreadcrumbSchema } from '@/lib/seo/schema-builder';
import { REVALIDATE_SECONDS, SITE_URL, SITE_NAME } from '@/lib/utils/constants';
import { defaultMeta } from '@/lib/seo/meta-generator';
import { getSimilarPersons } from '@/lib/seo/internal-links';
import BioTabs from '@/components/BioTabs';
import SocialIcons from '@/components/SocialIcons';
import YandexShare from '@/components/YandexShare';
import InfiniteNext from '@/components/InfiniteNext';

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
      include: { categories: { include: { category: true } } }
    });
  } catch {
    return null;
  }
}

async function getNextBio(currentId) {
  try {
    const next = await db.person.findFirst({
      where: { status: 'PUBLISHED', id: { gt: currentId } },
      orderBy: { id: 'asc' },
      select: { slug: true }
    });
    return next;
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
      images: person.photo_url ? [{ url: person.photo_url, width: 884, height: 1140 }] : []
    }
  };
}

function formatDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, '0')}.${String(dt.getUTCMonth() + 1).padStart(2, '0')}.${dt.getUTCFullYear()}`;
}

function parseJson(v, fallback) {
  if (Array.isArray(v) || (v && typeof v === 'object')) return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return fallback;
}

export default async function BioPage({ params }) {
  const person = await getPerson(params.slug);
  if (!person) notFound();

  const sections = parseJson(person.sections, []);
  const photos = parseJson(person.photos, []);
  const videos = parseJson(person.videos, []);
  const socials = parseJson(person.social_links, []);

  const personSchema = buildPersonSchema(person);
  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Главная страница', url: SITE_URL },
    { name: person.name, url: `${SITE_URL}/bio/${person.slug}` }
  ]);

  const similar = await getSimilarPersons(person.id, 4);
  const next = await getNextBio(person.id);
  const nextUrl = next ? `${SITE_URL}/bio/${next.slug}` : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <section className="catalog">
        <div className="container">
          <h1 className="author_title">{person.name}</h1>
          {person.profession && <p className="was">{person.profession}</p>}

          <YandexShare />

          <div className="card_cols">
            <div className="card_left descop">
              <div
                className="author_photo"
                style={person.photo_url ? { backgroundImage: `url(${person.photo_url})` } : undefined}
                role="img"
                aria-label={person.name}
              />
              <div className="author_info">
                <ul>
                  <li>
                    <h6>Имя</h6>
                    <p>{person.name}</p>
                  </li>
                  {person.birth_date && (
                    <li>
                      <h6>Дата рождения</h6>
                      <p>{formatDate(person.birth_date)}</p>
                    </li>
                  )}
                  {person.death_date && (
                    <li>
                      <h6>Дата смерти</h6>
                      <p>{formatDate(person.death_date)}</p>
                    </li>
                  )}
                  {person.birth_place && (
                    <li>
                      <h6>Место рождения</h6>
                      <p>{person.birth_place}</p>
                    </li>
                  )}
                  {person.zodiac && (
                    <li>
                      <h6>По зодиаку</h6>
                      <p>{person.zodiac}</p>
                    </li>
                  )}
                  <SocialIcons links={socials} />
                </ul>
              </div>
            </div>

            <div className="card_right">
              {person.intro && (
                <p style={{ marginBottom: 16 }}>
                  <strong>{person.name}</strong> — {person.intro}
                </p>
              )}

              <BioTabs
                sections={sections}
                bioHtml={person.bio_full}
                photos={photos}
                videos={videos}
              />
            </div>

            <div className="card_left mobile">
              <div
                className="author_photo"
                style={person.photo_url ? { backgroundImage: `url(${person.photo_url})` } : undefined}
              />
              <div className="author_info">
                <ul>
                  <li><h6>Имя</h6><p>{person.name}</p></li>
                  {person.birth_date && (<li><h6>Дата рождения</h6><p>{formatDate(person.birth_date)}</p></li>)}
                  {person.birth_place && (<li><h6>Место рождения</h6><p>{person.birth_place}</p></li>)}
                  {person.zodiac && (<li><h6>По зодиаку</h6><p>{person.zodiac}</p></li>)}
                  <SocialIcons links={socials} />
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {similar.length > 0 && (
        <div className="container other_persons">
          <h3 className="line">Другие лица</h3>
          <div className="items">
            {similar.map((p) => (
              <div className="item" key={p.slug}>
                <Link href={`/bio/${p.slug}`} title={p.name}>
                  <div
                    className="item_img"
                    style={p.photo_url ? { backgroundImage: `url(${p.photo_url})` } : undefined}
                  />
                  <p>{p.name}</p>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <InfiniteNext nextUrl={nextUrl} />
    </>
  );
}
