import 'dotenv/config';
import axios from 'axios';
import { db } from '../lib/db/index.js';
import { slugify } from '../lib/utils/slugify.js';

const WP_URL = process.env.WP_SOURCE_URL || 'https://lichnosty.ru';
const WP_USER = process.env.WP_APP_USER;
const WP_PASS = process.env.WP_APP_PASSWORD;

const auth = WP_USER && WP_PASS
  ? { username: WP_USER, password: WP_PASS }
  : undefined;

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, '').trim();
}

async function fetchPage(type, page) {
  const r = await axios.get(`${WP_URL}/wp-json/wp/v2/${type}`, {
    params: { page, per_page: 50, context: auth ? 'edit' : 'view' },
    auth,
    validateStatus: (s) => s < 500
  });
  if (r.status >= 400) return [];
  return r.data;
}

async function migratePersons() {
  let page = 1;
  let total = 0;
  for (;;) {
    const posts = await fetchPage('lico', page);
    if (!posts.length) break;

    for (const post of posts) {
      const title = stripHtml(post.title?.rendered);
      if (!title) continue;
      const slug = post.slug || slugify(title);
      const meta = post.meta || {};

      await db.person.upsert({
        where: { slug },
        create: {
          slug,
          name: title,
          bio_full: post.content?.rendered || '',
          bio_short: stripHtml(post.excerpt?.rendered).slice(0, 280),
          photo_url: meta.photo_url || post.featured_media_url || null,
          birth_date: meta.birth_date ? new Date(meta.birth_date) : null,
          death_date: meta.death_date ? new Date(meta.death_date) : null,
          birth_place: meta.birth_place || null,
          profession: meta.profession || null,
          zodiac: meta.zodiac || null,
          status: 'PUBLISHED',
          created_at: post.date ? new Date(post.date) : new Date(),
          ai_model: 'migrated:wordpress'
        },
        update: {
          name: title,
          bio_full: post.content?.rendered || '',
          bio_short: stripHtml(post.excerpt?.rendered).slice(0, 280),
          photo_url: meta.photo_url || post.featured_media_url || null
        }
      });
      total++;
    }
    console.log(`[migrate] page ${page}: ${posts.length} posts (total: ${total})`);
    page++;
  }
  return total;
}

async function migrateCategories() {
  let page = 1;
  let total = 0;
  for (;;) {
    const cats = await fetchPage('lico_cat', page);
    if (!cats.length) break;
    for (const c of cats) {
      const name = stripHtml(c.name);
      const slug = c.slug || slugify(name);
      await db.category.upsert({
        where: { slug },
        create: { slug, name, description: stripHtml(c.description) },
        update: { name, description: stripHtml(c.description) }
      });
      total++;
    }
    page++;
  }
  return total;
}

async function main() {
  console.log(`[migrate] source: ${WP_URL}`);
  console.log(`[migrate] auth: ${auth ? 'application password' : 'public'}`);

  const cats = await migrateCategories();
  console.log(`[migrate] categories: ${cats}`);

  const persons = await migratePersons();
  console.log(`[migrate] persons: ${persons}`);

  await db.$disconnect();
  console.log('[migrate] done');
}

main().catch((e) => { console.error(e); process.exit(1); });
