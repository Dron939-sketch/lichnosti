import { SITE_URL, SITE_NAME } from '../utils/constants.js';

export function buildPersonSchema(person) {
  const url = `${SITE_URL}/bio/${person.slug}`;
  const social = Array.isArray(person.social_links)
    ? person.social_links
    : (() => { try { return JSON.parse(person.social_links || '[]'); } catch { return []; } })();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url }
  };
  if (person.photo_url) schema.image = person.photo_url;
  if (person.birth_date) schema.birthDate = new Date(person.birth_date).toISOString().slice(0, 10);
  if (person.death_date) schema.deathDate = new Date(person.death_date).toISOString().slice(0, 10);
  if (person.birth_place) schema.birthPlace = { '@type': 'Place', name: person.birth_place };
  if (person.profession) schema.jobTitle = person.profession;
  if (social.length) schema.sameAs = social.map((s) => (typeof s === 'string' ? s : s.url)).filter(Boolean);
  return schema;
}

export function buildBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url
    }))
  };
}

export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={query}`,
      'query-input': 'required name=query'
    }
  };
}
