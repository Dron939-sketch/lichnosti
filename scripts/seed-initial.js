import 'dotenv/config';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { db } from '../lib/db/index.js';
import { generationQueue } from '../lib/ai/queue.js';
import { slugify } from '../lib/utils/slugify.js';

const CATEGORIES = [
  { slug: 'znamenitosti', name: 'Знаменитости' },
  { slug: 'obrazovanie',  name: 'Образование' },
  { slug: 'sport',        name: 'Спорт' },
  { slug: 'gosudarstvo',  name: 'Государство' },
  { slug: 'biznes',       name: 'Бизнес' },
  { slug: 'blogery',      name: 'Блогеры' },
  { slug: 'eksperty',     name: 'Эксперты' }
];

const SEED_PERSONS = [
  { name: 'Юрий Гагарин',       category: 'znamenitosti' },
  { name: 'Анна Ахматова',      category: 'znamenitosti' },
  { name: 'Фёдор Достоевский',  category: 'znamenitosti' },
  { name: 'Лев Толстой',        category: 'znamenitosti' },
  { name: 'Дмитрий Менделеев',  category: 'obrazovanie' },
  { name: 'Пётр Чайковский',    category: 'znamenitosti' },
  { name: 'Алина Загитова',     category: 'sport' },
  { name: 'Александр Пушкин',   category: 'znamenitosti' },
  { name: 'Михаил Ломоносов',   category: 'obrazovanie' },
  { name: 'Сергей Королёв',     category: 'obrazovanie' }
];

const EXPORT_JSON = 'migration/db/lico_export.json';

function runSubprocess(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    p.on('error', reject);
  });
}

async function main() {
  console.log('[seed] upserting categories...');
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c
    });
  }

  // If the migration dump is present, import it first (real biographies,
  // no DeepSeek tokens spent). Safe to run repeatedly — it upserts by slug.
  if (fs.existsSync(EXPORT_JSON)) {
    console.log(`[seed] found ${EXPORT_JSON}, running import-from-json...`);
    try {
      await runSubprocess('node', ['scripts/import-from-json.js', EXPORT_JSON]);
    } catch (e) {
      console.warn(`[seed] import failed: ${e.message}. Continuing with AI queue.`);
    }
  } else {
    console.log(`[seed] no ${EXPORT_JSON}, skipping migration import.`);
  }

  console.log('[seed] queueing initial persons for AI generation...');
  let queued = 0;
  for (const p of SEED_PERSONS) {
    const slug = slugify(p.name);
    const existing = await db.person.findUnique({ where: { slug } });
    if (existing) {
      console.log(`[seed] skip existing: ${p.name}`);
      continue;
    }
    const job = await generationQueue.add('generate', {
      name: p.name,
      category: p.category,
      context: null
    });
    console.log(`[seed] queued ${p.name} (job=${job.id})`);
    queued++;
  }

  console.log(`[seed] done. queued=${queued}`);
  await db.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
