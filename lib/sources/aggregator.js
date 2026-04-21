import { db } from '../db/index.js';
import { birthdayPersonsToday, deathAnniversaryToday } from './wikipedia-ru.js';
import { collectNewsCandidates } from './news-rss.js';
import { collectWordstatCandidates } from './yandex-wordstat.js';
import { collectKinopoiskCandidates } from './kinopoisk.js';
import { slugify } from '../utils/slugify.js';

export async function collectAllSources({ date = new Date() } = {}) {
  const results = [];
  const errors = [];

  const push = (arr) => { for (const c of arr) if (c) results.push(c); };

  await Promise.all([
    birthdayPersonsToday({ date })
      .then(push)
      .catch((e) => errors.push({ src: 'wikipedia-birthday', error: e.message })),
    deathAnniversaryToday({ date })
      .then(push)
      .catch((e) => errors.push({ src: 'wikipedia-death', error: e.message })),
    collectNewsCandidates()
      .then(({ candidates, errors: e }) => { push(candidates); errors.push(...e); })
      .catch((e) => errors.push({ src: 'news-rss', error: e.message })),
    collectWordstatCandidates()
      .then(({ candidates, errors: e }) => { push(candidates); errors.push(...e); })
      .catch((e) => errors.push({ src: 'wordstat', error: e.message })),
    collectKinopoiskCandidates()
      .then(({ candidates, errors: e }) => { push(candidates); errors.push(...e); })
      .catch((e) => errors.push({ src: 'kinopoisk', error: e.message }))
  ]);

  return { candidates: results, errors };
}

function dedupe(candidates) {
  const map = new Map();
  for (const c of candidates) {
    const key = slugify(c.name);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || existing.score < c.score) map.set(key, { ...c, slug: key });
  }
  return Array.from(map.values());
}

export async function saveCandidates(candidates) {
  let inserted = 0;
  let updated = 0;
  const existingPersons = new Set(
    (await db.person.findMany({ select: { slug: true } })).map((p) => p.slug)
  );

  const unique = dedupe(candidates);

  for (const c of unique) {
    if (existingPersons.has(c.slug)) continue;

    const r = await db.trendCandidate.upsert({
      where: { name_source: { name: c.name, source: c.source } },
      create: {
        name: c.name,
        source: c.source,
        score: c.score
      },
      update: {
        score: c.score,
        processed: false
      }
    });
    if (r.created_at.getTime() > Date.now() - 5_000) inserted++; else updated++;
  }
  return { inserted, updated, total: unique.length };
}

export async function runCollectAndSave({ date = new Date() } = {}) {
  const { candidates, errors } = await collectAllSources({ date });
  const save = await saveCandidates(candidates);
  return { collected: candidates.length, ...save, errors };
}
