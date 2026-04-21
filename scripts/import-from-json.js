#!/usr/bin/env node
/**
 * Импорт биографий из JSON-дампа, полученного скриптом
 * scripts/export-from-wordpress.php.
 *
 * Usage:
 *   node scripts/import-from-json.js migration/db/lico_export.json
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../lib/db/index.js';
import { normalizePerson } from '../lib/migrate/parse-wp.js';
import { slugify } from '../lib/utils/slugify.js';

async function main() {
  const inputPath = process.argv[2] || 'migration/db/lico_export.json';
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const dump = JSON.parse(raw);

  console.log(`[import] source: ${dump.site || inputPath}`);
  console.log(`[import] exported: ${dump.exported || 'unknown'}`);
  console.log(`[import] categories: ${dump.categories?.length || 0}`);
  console.log(`[import] persons: ${dump.persons?.length || 0}`);

  // 1. Категории
  const categories = Array.isArray(dump.categories) ? dump.categories : [];
  const categoryBySlug = new Map();
  for (const c of categories) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description || null
      },
      update: {
        name: c.name,
        description: c.description || null
      }
    });
    categoryBySlug.set(c.slug, row.id);
  }
  console.log(`[import] categories upserted: ${categoryBySlug.size}`);

  // 2. Биографии
  const persons = Array.isArray(dump.persons) ? dump.persons : [];
  const wpIdToDbId = new Map();
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of persons) {
    try {
      const norm = normalizePerson(post);
      if (!norm.name || !norm.slug) {
        console.warn(`[import] skip wp_id=${post.id}: empty name/slug`);
        skipped++;
        continue;
      }

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

      // Привязка категорий
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
      if (ok % 50 === 0) console.log(`[import] progress: ${ok}/${persons.length}`);
    } catch (err) {
      console.error(`[import] FAIL wp_id=${post.id} slug=${post.slug}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n[import] DONE`);
  console.log(`  ok:      ${ok}`);
  console.log(`  skipped: ${skipped}`);
  console.log(`  failed:  ${failed}`);

  // Сохраним mapping для последующих скриптов (import-uploads и т.п.)
  const mapPath = path.join(path.dirname(inputPath), 'wp_id_to_db_id.json');
  fs.writeFileSync(mapPath, JSON.stringify(Object.fromEntries(wpIdToDbId), null, 2));
  console.log(`[import] wrote id mapping: ${mapPath}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
