import fs from 'node:fs';
import path from 'node:path';
import { normalizePerson } from './parse-wp.js';

const DEFAULT_CATEGORIES = [
  { slug: 'znamenitosti', name: 'Знаменитости' },
  { slug: 'obrazovanie',  name: 'Образование' },
  { slug: 'sport',        name: 'Спорт' },
  { slug: 'gosudarstvo',  name: 'Государство' },
  { slug: 'biznes',       name: 'Бизнес' },
  { slug: 'blogery',      name: 'Блогеры' },
  { slug: 'eksperty',     name: 'Эксперты' }
];

/**
 * Load the export JSON, upsert categories and persons into Prisma.
 * Shared between scripts/import-from-json.js (CLI) and
 * app/api/admin/init/route.js (HTTP).
 */
export async function importFromJson({ db, jsonPath, logger = console }) {
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON dump not found: ${jsonPath}`);
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const dump = JSON.parse(raw);

  const categories = Array.isArray(dump.categories) && dump.categories.length > 0
    ? dump.categories
    : DEFAULT_CATEGORIES;
  const persons = Array.isArray(dump.persons) ? dump.persons : [];

  logger.log(`[import] source: ${dump.site || jsonPath}`);
  logger.log(`[import] categories=${categories.length} persons=${persons.length}`);

  // 1. Categories
  const categoryBySlug = new Map();
  for (const c of categories) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, description: c.description || null },
      update: { name: c.name, description: c.description || null }
    });
    categoryBySlug.set(c.slug, row.id);
  }

  // 2. Persons
  const wpIdToDbId = new Map();
  let ok = 0, skipped = 0, failed = 0;
  const errors = [];

  for (const post of persons) {
    try {
      const norm = normalizePerson(post);
      if (!norm.name || !norm.slug) { skipped++; continue; }

      const person = await db.person.upsert({
        where: { slug: norm.slug },
        create: {
          slug: norm.slug,
          name: norm.name,
          intro: norm.intro,
          bio_full: norm.bio_full,
          bio_short: norm.bio_short,
          sections: norm.sections,
          photos: norm.photos,
          photo_url: norm.photo_url,
          birth_date: norm.birth_date,
          death_date: norm.death_date,
          birth_place: norm.birth_place,
          profession: norm.profession,
          zodiac: norm.zodiac,
          social_links: norm.social_links,
          status: 'PUBLISHED',
          ai_model: 'migrated:wordpress',
          created_at: norm.created_at,
          updated_at: norm.updated_at
        },
        update: {
          name: norm.name,
          intro: norm.intro,
          bio_full: norm.bio_full,
          bio_short: norm.bio_short,
          sections: norm.sections,
          photos: norm.photos,
          photo_url: norm.photo_url,
          birth_date: norm.birth_date,
          death_date: norm.death_date,
          birth_place: norm.birth_place,
          profession: norm.profession,
          zodiac: norm.zodiac,
          social_links: norm.social_links
        }
      });
      wpIdToDbId.set(post.id, person.id);

      for (const catSlug of norm.categories) {
        const catId = categoryBySlug.get(catSlug);
        if (!catId) continue;
        await db.categoryOnPerson.upsert({
          where: { person_id_category_id: { person_id: person.id, category_id: catId } },
          create: { person_id: person.id, category_id: catId },
          update: {}
        });
      }
      ok++;
    } catch (err) {
      errors.push({ wp_id: post?.id, slug: post?.slug, error: String(err?.message || err) });
      failed++;
    }
  }

  return {
    categories: categoryBySlug.size,
    persons: { ok, skipped, failed },
    errors,
    wp_id_to_db_id: Object.fromEntries(wpIdToDbId)
  };
}

/**
 * Save the id mapping file next to the JSON dump. CLI helper only.
 */
export function writeIdMapping(jsonPath, wpIdToDbId) {
  const mapPath = path.join(path.dirname(jsonPath), 'wp_id_to_db_id.json');
  fs.writeFileSync(mapPath, JSON.stringify(wpIdToDbId, null, 2));
  return mapPath;
}
