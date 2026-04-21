#!/usr/bin/env node
/**
 * Импорт биографий напрямую из mysqldump SQL-дампа (fallback если JSON-экспорт невозможен).
 *
 * Usage:
 *   node scripts/import-from-sql.js migration/db/lichnosty.sql [--prefix=wp_] [--dry]
 *
 * Поддерживает .sql и .sql.gz.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../lib/db/index.js';
import { iterateInserts, rowsToObjects, WP_SCHEMAS } from '../lib/migrate/sql-parser.js';
import { normalizePerson } from '../lib/migrate/parse-wp.js';

function arg(name, def = null) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
}
const DRY = process.argv.includes('--dry');
const PREFIX = arg('prefix', 'wp_');

const T = {
  posts: `${PREFIX}posts`,
  postmeta: `${PREFIX}postmeta`,
  terms: `${PREFIX}terms`,
  term_taxonomy: `${PREFIX}term_taxonomy`,
  term_relationships: `${PREFIX}term_relationships`
};

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath || !fs.existsSync(dumpPath)) {
    console.error('Usage: import-from-sql.js <dump.sql[.gz]> [--prefix=wp_] [--dry]');
    process.exit(1);
  }

  console.log(`[sql-import] reading ${dumpPath} (prefix=${PREFIX})`);
  const schemaFor = (t) => WP_SCHEMAS[t.replace(PREFIX, 'wp_')] || null;

  // Tables we care about
  const wantedTables = new Set([T.posts, T.postmeta, T.terms, T.term_taxonomy, T.term_relationships]);

  // Collect tables into memory (typical WP dumps are manageable).
  const posts = [];
  const postmetaByPost = new Map();
  const terms = [];
  const termTax = [];
  const relByObject = new Map();

  for await (const ins of iterateInserts(dumpPath, { onlyTables: wantedTables })) {
    const schema = ins.columns || schemaFor(ins.table);
    if (!schema) {
      console.warn(`[sql-import] no schema for ${ins.table}, skipping`);
      continue;
    }
    const objs = rowsToObjects(ins.rows, ins.columns, schema);

    if (ins.table === T.posts) {
      for (const p of objs) {
        if (p.post_type !== 'lico') continue;
        if (p.post_status === 'trash' || p.post_status === 'auto-draft') continue;
        posts.push(p);
      }
    } else if (ins.table === T.postmeta) {
      for (const m of objs) {
        if (!postmetaByPost.has(m.post_id)) postmetaByPost.set(m.post_id, {});
        postmetaByPost.get(m.post_id)[m.meta_key] = m.meta_value;
      }
    } else if (ins.table === T.terms) {
      terms.push(...objs);
    } else if (ins.table === T.term_taxonomy) {
      for (const tt of objs) if (tt.taxonomy === 'lico_cat') termTax.push(tt);
    } else if (ins.table === T.term_relationships) {
      for (const r of objs) {
        if (!relByObject.has(r.object_id)) relByObject.set(r.object_id, []);
        relByObject.get(r.object_id).push(r.term_taxonomy_id);
      }
    }
  }

  console.log(`[sql-import] parsed posts(lico)=${posts.length} meta-posts=${postmetaByPost.size} term_tax(lico_cat)=${termTax.length}`);

  // Build lico_cat categories map (term_id → {slug,name})
  const termById = new Map(terms.map((t) => [t.term_id, t]));
  const catSlugByTaxId = new Map();
  const categories = [];
  for (const tt of termTax) {
    const term = termById.get(tt.term_id);
    if (!term) continue;
    categories.push({ slug: term.slug, name: term.name, description: tt.description || '' });
    catSlugByTaxId.set(tt.term_taxonomy_id, term.slug);
  }

  if (DRY) {
    console.log('[sql-import] DRY run, would import:');
    console.log('  categories:', categories.length);
    console.log('  persons:   ', posts.length);
    console.log('  example post:', posts[0] && { id: posts[0].ID, slug: posts[0].post_name, title: posts[0].post_title });
    return;
  }

  // Upsert categories
  const categoryBySlug = new Map();
  for (const c of categories) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, description: c.description || null },
      update: { name: c.name, description: c.description || null }
    });
    categoryBySlug.set(c.slug, row.id);
  }
  console.log(`[sql-import] categories upserted: ${categoryBySlug.size}`);

  // Import persons
  const wpIdToDbId = new Map();
  let ok = 0, skipped = 0, failed = 0;

  for (const p of posts) {
    try {
      const meta = postmetaByPost.get(p.ID) || {};
      const catSlugs = (relByObject.get(p.ID) || [])
        .map((ttid) => catSlugByTaxId.get(ttid))
        .filter(Boolean);

      const fakePost = {
        id: p.ID,
        slug: p.post_name,
        title: p.post_title,
        content: p.post_content,
        excerpt: p.post_excerpt,
        date: p.post_date_gmt,
        modified: p.post_modified_gmt,
        status: p.post_status,
        categories: catSlugs,
        meta,
        thumbnail: null,
        attachments: []
      };
      const norm = normalizePerson(fakePost);

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
          ai_model: 'migrated:wordpress-sql',
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
      wpIdToDbId.set(p.ID, person.id);

      for (const slug of catSlugs) {
        const catId = categoryBySlug.get(slug);
        if (!catId) continue;
        await db.categoryOnPerson.upsert({
          where: { person_id_category_id: { person_id: person.id, category_id: catId } },
          create: { person_id: person.id, category_id: catId },
          update: {}
        });
      }
      ok++;
      if (ok % 50 === 0) console.log(`[sql-import] progress: ${ok}/${posts.length}`);
    } catch (e) {
      console.error(`[sql-import] FAIL ID=${p.ID}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n[sql-import] DONE`);
  console.log(`  ok:      ${ok}`);
  console.log(`  skipped: ${skipped}`);
  console.log(`  failed:  ${failed}`);

  const mapPath = path.join(path.dirname(dumpPath), 'wp_id_to_db_id.json');
  fs.writeFileSync(mapPath, JSON.stringify(Object.fromEntries(wpIdToDbId), null, 2));
  console.log(`[sql-import] wrote id mapping: ${mapPath}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
