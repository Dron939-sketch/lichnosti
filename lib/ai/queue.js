import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '../redis.js';
import { db } from '../db/index.js';
import { deepseekGenerate } from './deepseek-client.js';
import { slugify } from '../utils/slugify.js';
import { SITE_URL } from '../utils/constants.js';
import { addInternalLinks } from '../seo/internal-links.js';

const connection = redis;

export const generationQueue = new Queue('bio-generation', { connection });
export const queueEvents = new QueueEvents('bio-generation', { connection });

async function processGenerate(job) {
  const { name, category, context } = job.data;
  const slug = slugify(name);

  const log = await db.generationLog.create({
    data: {
      job_id: String(job.id),
      kind: 'generate',
      prompt_key: 'full_bio',
      status: 'RUNNING'
    }
  });

  try {
    const check = await deepseekGenerate('validate_russian', { name });
    const isRussian = check?.data?.is_russian === true;
    if (!isRussian) {
      await db.generationLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          error: `rejected:not_russian (${check?.data?.reason || 'unknown'})`,
          finished_at: new Date()
        }
      });
      return { success: false, rejected: 'not_russian', reason: check?.data?.reason };
    }
    const inferredCategory = category || check?.data?.category_hint || null;

    const bio = await deepseekGenerate('full_bio', { name, category: inferredCategory, context });

    if (bio.text?.includes('"error"') && /not_russian/.test(bio.text)) {
      await db.generationLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          error: 'rejected:not_russian (full_bio refused)',
          finished_at: new Date()
        }
      });
      return { success: false, rejected: 'not_russian' };
    }

    const seo = await deepseekGenerate('seo_meta', { name, bio: bio.text });
    const short = await deepseekGenerate('short_bio', { name, bio: bio.text });
    const similar = await deepseekGenerate('similar_persons', { name, category: inferredCategory });

    const tokensIn =
      (check.usage?.prompt_tokens || 0) +
      (bio.usage?.prompt_tokens || 0) +
      (seo.usage?.prompt_tokens || 0) +
      (short.usage?.prompt_tokens || 0) +
      (similar.usage?.prompt_tokens || 0);
    const tokensOut =
      (check.usage?.completion_tokens || 0) +
      (bio.usage?.completion_tokens || 0) +
      (seo.usage?.completion_tokens || 0) +
      (short.usage?.completion_tokens || 0) +
      (similar.usage?.completion_tokens || 0);

    const seoData = seo.data || {};
    const bioWithLinks = await addInternalLinks(bio.text, null);

    const categoryConnect = inferredCategory
      ? await (async () => {
          const cat = await db.category.findUnique({ where: { slug: inferredCategory } });
          return cat ? { categories: { create: [{ category_id: cat.id }] } } : {};
        })()
      : {};

    const person = await db.person.upsert({
      where: { slug },
      create: {
        slug,
        name,
        bio_full: bioWithLinks,
        bio_short: short.text?.trim() || '',
        seo_title: seoData.title || `${name} — биография`,
        seo_desc: seoData.description || '',
        seo_keywords: seoData.keywords || '',
        ai_model: bio.model,
        ai_tokens: tokensIn + tokensOut,
        status: 'PUBLISHED',
        ...categoryConnect
      },
      update: {
        bio_full: bioWithLinks,
        bio_short: short.text?.trim() || '',
        seo_title: seoData.title,
        seo_desc: seoData.description,
        seo_keywords: seoData.keywords,
        ai_model: bio.model,
        ai_tokens: { increment: tokensIn + tokensOut },
        last_ai_check: new Date()
      }
    });

    await db.generationLog.update({
      where: { id: log.id },
      data: {
        person_id: person.id,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        status: 'DONE',
        finished_at: new Date()
      }
    });

    try {
      await fetch(`${SITE_URL}/api/revalidate?secret=${process.env.REVALIDATE_SECRET}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, type: 'person' })
      });
    } catch (e) {
      console.warn('revalidate call failed:', e.message);
    }

    return {
      success: true,
      slug,
      similar: similar.data || []
    };
  } catch (err) {
    await db.generationLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        error: String(err?.message || err),
        finished_at: new Date()
      }
    });
    throw err;
  }
}

async function processUpdate(job) {
  const { personId, newFacts } = job.data;
  const person = await db.person.findUnique({ where: { id: personId } });
  if (!person) return { skipped: true };

  const bio = await deepseekGenerate(
    'full_bio',
    {
      name: person.name,
      category: null,
      context: `Учти следующие новые факты: ${Array.isArray(newFacts) ? newFacts.join('; ') : newFacts}`
    },
    { noCache: true }
  );

  const bioWithLinks = await addInternalLinks(bio.text, personId);
  await db.person.update({
    where: { id: personId },
    data: {
      bio_full: bioWithLinks,
      ai_model: bio.model,
      ai_tokens: { increment: (bio.usage?.prompt_tokens || 0) + (bio.usage?.completion_tokens || 0) },
      last_ai_check: new Date()
    }
  });

  return { success: true, slug: person.slug };
}

export function createWorker() {
  return new Worker(
    'bio-generation',
    async (job) => {
      if (job.name === 'generate') return processGenerate(job);
      if (job.name === 'update') return processUpdate(job);
      throw new Error(`Unknown job name: ${job.name}`);
    },
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY || 2),
      limiter: { max: 10, duration: 60_000 }
    }
  );
}
