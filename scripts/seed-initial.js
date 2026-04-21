import 'dotenv/config';
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

async function main() {
  console.log('[seed] upserting categories...');
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c
    });
  }

  console.log('[seed] queueing initial persons...');
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
