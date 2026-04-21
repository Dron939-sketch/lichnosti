import { db } from '../db/index.js';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function addInternalLinks(bioHtml, currentPersonId) {
  if (!bioHtml) return '';

  const allPersons = await db.person.findMany({
    where: currentPersonId ? { id: { not: currentPersonId } } : {},
    select: { id: true, name: true, slug: true },
    take: 5000
  });

  const sorted = allPersons.sort((a, b) => b.name.length - a.name.length);
  let html = bioHtml;

  for (const p of sorted) {
    const re = new RegExp(`(?<!\\w|>|")\\b${escapeRegExp(p.name)}\\b(?!\\w|<\\/a>)`, 'g');
    let replaced = false;
    html = html.replace(re, (match) => {
      if (replaced) return match;
      replaced = true;
      return `<a href="/bio/${p.slug}">${match}</a>`;
    });
  }

  if (currentPersonId) {
    const similar = await getSimilarPersons(currentPersonId, 4);
    if (similar.length) {
      html += `
<div class="also-read">
  <h3>Читайте также</h3>
  <ul>
    ${similar.map((p) => `<li><a href="/bio/${p.slug}">${p.name}</a></li>`).join('')}
  </ul>
</div>`;
    }
  }

  return html;
}

export async function getSimilarPersons(personId, limit = 4) {
  const person = await db.person.findUnique({
    where: { id: personId },
    include: { categories: { select: { category_id: true } } }
  });
  if (!person) return [];

  if (Array.isArray(person.similar_ids) && person.similar_ids.length) {
    const rows = await db.person.findMany({
      where: { id: { in: person.similar_ids }, status: 'PUBLISHED' },
      select: { id: true, name: true, slug: true },
      take: limit
    });
    if (rows.length) return rows;
  }

  const catIds = person.categories.map((c) => c.category_id);
  if (!catIds.length) {
    return db.person.findMany({
      where: { status: 'PUBLISHED', id: { not: personId } },
      orderBy: { views: 'desc' },
      take: limit,
      select: { id: true, name: true, slug: true }
    });
  }

  return db.person.findMany({
    where: {
      status: 'PUBLISHED',
      id: { not: personId },
      categories: { some: { category_id: { in: catIds } } }
    },
    orderBy: { views: 'desc' },
    take: limit,
    select: { id: true, name: true, slug: true }
  });
}
