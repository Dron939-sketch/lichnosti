import 'dotenv/config';
import { db } from '../lib/db/index.js';
import { generationQueue } from '../lib/ai/queue.js';
import { slugify } from '../lib/utils/slugify.js';

const CATEGORIES = [
  { slug: 'aktyory',   name: 'Актёры' },
  { slug: 'muzyka',    name: 'Музыка' },
  { slug: 'sport',     name: 'Спорт' },
  { slug: 'nauka',     name: 'Наука' },
  { slug: 'politika',  name: 'Политика' },
  { slug: 'literatura',name: 'Литература' },
  { slug: 'kino',      name: 'Кино' },
  { slug: 'biznes',    name: 'Бизнес' }
];

const SEED_PERSONS = [
  { name: 'Юрий Гагарин',       category: 'nauka' },
  { name: 'Анна Ахматова',      category: 'literatura' },
  { name: 'Фёдор Достоевский',  category: 'literatura' },
  { name: 'Лев Толстой',        category: 'literatura' },
  { name: 'Дмитрий Менделеев',  category: 'nauka' },
  { name: 'Пётр Чайковский',    category: 'muzyka' },
  { name: 'Сергей Бубка',       category: 'sport' },
  { name: 'Александр Пушкин',   category: 'literatura' },
  { name: 'Михаил Ломоносов',   category: 'nauka' },
  { name: 'Сергей Королёв',     category: 'nauka' }
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
