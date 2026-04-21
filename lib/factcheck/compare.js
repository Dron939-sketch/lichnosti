import { deepseekGenerate } from '../ai/deepseek-client.js';
import { resolveWikipediaPage } from './wikipedia-ru.js';
import { db } from '../db/index.js';

/**
 * Compare our generated bio against Wikipedia ru intro via DeepSeek fact_check prompt.
 * Returns: { ok, issues[], wiki_url, wiki_excerpt } or null if no wiki page found.
 */
export async function factCheckPerson(personId) {
  const person = await db.person.findUnique({ where: { id: personId } });
  if (!person) return { ok: null, error: 'person_not_found' };

  const wiki = await resolveWikipediaPage(person.name);
  if (!wiki) {
    await db.generationLog.create({
      data: {
        person_id: personId,
        kind: 'fact_check',
        prompt_key: 'fact_check',
        status: 'DONE',
        error: 'no_wiki_page'
      }
    });
    return { ok: null, error: 'no_wiki_page' };
  }

  const bioText = (person.bio_full || '').replace(/<[^>]+>/g, ' ').slice(0, 6000);
  const combined = `НАША БИОГРАФИЯ:\n${bioText}\n\nВЫДЕРЖКА ИЗ РУССКОЙ ВИКИПЕДИИ:\n${wiki.extract.slice(0, 3000)}`;

  const result = await deepseekGenerate(
    'fact_check',
    { name: person.name, bio: combined },
    { noCache: true, temperature: 0.2 }
  );

  const out = result.data || { ok: null, issues: ['parse_failed'] };
  const tokensIn = result.usage?.prompt_tokens || 0;
  const tokensOut = result.usage?.completion_tokens || 0;

  await db.generationLog.create({
    data: {
      person_id: personId,
      kind: 'fact_check',
      prompt_key: 'fact_check',
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      status: 'DONE',
      error: out.ok === false ? JSON.stringify(out.issues).slice(0, 500) : null
    }
  });

  if (out.ok === false) {
    await db.person.update({
      where: { id: personId },
      data: { source_refs: [{ type: 'wikipedia_ru', url: wiki.url, issues: out.issues || [] }] }
    });
  } else if (out.ok === true) {
    await db.person.update({
      where: { id: personId },
      data: { source_refs: [{ type: 'wikipedia_ru', url: wiki.url, verified: true }] }
    });
  }

  return { ok: out.ok, issues: out.issues || [], wiki_url: wiki.url, wiki_excerpt: wiki.extract.slice(0, 500) };
}

/**
 * Pick persons that never had a fact_check run or had one older than N days.
 */
export async function pickPersonsForFactCheck({ limit = 5, olderThanDays = 30 } = {}) {
  const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  // Persons with no fact_check log ever OR with last log older than threshold
  const rows = await db.person.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      name: true,
      slug: true,
      updated_at: true
    },
    orderBy: { updated_at: 'desc' },
    take: limit * 4
  });

  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];

  const recentChecks = await db.generationLog.findMany({
    where: { kind: 'fact_check', person_id: { in: ids }, created_at: { gt: threshold } },
    select: { person_id: true }
  });
  const checkedSet = new Set(recentChecks.map((r) => r.person_id));

  return rows.filter((r) => !checkedSet.has(r.id)).slice(0, limit);
}
