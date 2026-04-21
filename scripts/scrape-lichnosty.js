#!/usr/bin/env node
/**
 * Парсер биографий с lichnosty.ru.
 *
 * Запускается на ВАШЕЙ машине с доступом в интернет — НЕ в нашем sandbox.
 *
 * Usage:
 *   node scripts/scrape-lichnosty.js                       # всё с lichnosty.ru
 *   node scripts/scrape-lichnosty.js https://other.ru      # другой источник
 *   SCRAPE_DELAY_MS=2000 node scripts/scrape-lichnosty.js  # медленнее (по умолчанию 1200 мс)
 *   node scripts/scrape-lichnosty.js --limit=5             # только 5 биографий для теста
 *   node scripts/scrape-lichnosty.js --url https://lichnosty.ru/bio/andrey-yurevich-meyster/
 *
 * Результат:
 *   migration/db/lico_export.json  — в формате, совместимом с npm run import:json
 *   public/media/YYYY/MM/*.jpg      — все фото, URL-ы переписаны на /media/...
 */
import 'dotenv/config';
import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { scrapeBio } from '../lib/migrate/scrape-bio.js';

const DEFAULT_SOURCE = process.argv.find((a) => /^https?:\/\//.test(a)) || 'https://lichnosty.ru';
const OUT_JSON = 'migration/db/lico_export.json';
const MEDIA_ROOT = 'public/media';
const UA = 'LichnostyMigrationBot/1.0 (+https://github.com/Dron939-sketch/lichnosti)';
const DELAY_MS = Number(process.env.SCRAPE_DELAY_MS || 1200);

const DEFAULT_CATEGORIES = [
  { slug: 'znamenitosti', name: 'Знаменитости' },
  { slug: 'obrazovanie',  name: 'Образование' },
  { slug: 'sport',        name: 'Спорт' },
  { slug: 'gosudarstvo',  name: 'Государство' },
  { slug: 'biznes',       name: 'Бизнес' },
  { slug: 'blogery',      name: 'Блогеры' },
  { slug: 'eksperty',     name: 'Эксперты' }
];

function arg(name, def = null) {
  const v = process.argv.find((a) => a.startsWith(`--${name}=`));
  return v ? v.split('=')[1] : def;
}

function cliFlag(name) {
  return process.argv.includes(`--${name}`);
}

const LIMIT = Number(arg('limit', 0));
const SINGLE_URL = arg('url', null);
const DRY = cliFlag('dry');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

async function fetchText(url) {
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': UA, Accept: 'application/xml, text/xml, text/html, */*' },
    timeout: 30_000,
    responseType: 'text'
  });
  return data;
}

async function fetchSitemapBioUrls(base) {
  const robotsUrl = `${base}/robots.txt`;
  let sitemapIndex = `${base}/sitemap_index.xml`;
  try {
    const robots = await fetchText(robotsUrl);
    const m = robots.match(/^Sitemap:\s*(\S+)/im);
    if (m) sitemapIndex = m[1];
  } catch { /* ignore, use default */ }

  console.log(`[scrape] sitemap index: ${sitemapIndex}`);
  let doc;
  try {
    const xml = await fetchText(sitemapIndex);
    doc = parser.parse(xml);
  } catch (e) {
    throw new Error(`sitemap fetch failed: ${e.message}`);
  }

  const nested = [];
  if (doc.sitemapindex?.sitemap) {
    const arr = Array.isArray(doc.sitemapindex.sitemap) ? doc.sitemapindex.sitemap : [doc.sitemapindex.sitemap];
    for (const sm of arr) {
      if (sm.loc) nested.push(sm.loc);
    }
  } else if (doc.urlset?.url) {
    nested.push(sitemapIndex);
  }
  if (!nested.length) nested.push(sitemapIndex);

  const bioUrls = new Set();
  for (const smUrl of nested) {
    try {
      const xml = await fetchText(smUrl);
      const sub = parser.parse(xml);
      const entries = sub.urlset?.url || [];
      const arr = Array.isArray(entries) ? entries : [entries];
      for (const e of arr) {
        if (e?.loc && /\/bio\//.test(e.loc)) bioUrls.add(e.loc);
      }
    } catch (e) {
      console.warn(`[scrape] sitemap ${smUrl} failed: ${e.message}`);
    }
  }
  return Array.from(bioUrls);
}

async function downloadImage(url, destRoot) {
  const urlObj = new URL(url);
  const hadUploads = urlObj.pathname.includes('/wp-content/uploads/');
  const relPath = hadUploads
    ? urlObj.pathname.replace(/^.*\/wp-content\/uploads\//, '')
    : urlObj.pathname.replace(/^\/+/, '');

  const parts = relPath.split('/');
  let filename = parts.pop();
  filename = decodeURIComponent(filename)
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-');

  // Strip WP size variants automatically (e.g. "file-300x400.jpg" → "file.jpg")
  filename = filename.replace(/-\d+x\d+(\.[a-z]+)$/, '$1');
  filename = filename.replace(/-scaled(\.[a-z]+)$/, '$1');

  const dir = path.join(destRoot, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, filename);
  const publicPath = '/' + path.relative('public', destPath).split(path.sep).join('/');

  if (fs.existsSync(destPath)) return publicPath;
  if (DRY) return publicPath;

  const resp = await axios.get(url, {
    headers: { 'User-Agent': UA },
    responseType: 'arraybuffer',
    timeout: 60_000
  });
  fs.writeFileSync(destPath, resp.data);
  return publicPath;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processOne(url, index, total) {
  process.stdout.write(`[${index}/${total}] ${url} ... `);
  const post = await scrapeBio(url, { userAgent: UA });

  if (post.thumbnail && /^https?:\/\//.test(post.thumbnail)) {
    try { post.thumbnail = await downloadImage(post.thumbnail, MEDIA_ROOT); }
    catch (e) { console.warn(` thumbnail fail: ${e.message}`); }
  }

  for (const att of post.attachments || []) {
    if (att.url && /^https?:\/\//.test(att.url)) {
      try { att.url = await downloadImage(att.url, MEDIA_ROOT); }
      catch (e) { console.warn(` attachment fail: ${e.message}`); }
    }
  }

  console.log(`ok  "${post.title}"  sections=${(post.content.match(/<h2>/g) || []).length}`);
  return post;
}

async function main() {
  console.log(`[scrape] source: ${DEFAULT_SOURCE}`);
  console.log(`[scrape] delay:  ${DELAY_MS} ms${DRY ? '  [DRY RUN]' : ''}`);

  let urls;
  if (SINGLE_URL) {
    urls = [SINGLE_URL];
  } else {
    urls = await fetchSitemapBioUrls(DEFAULT_SOURCE);
  }
  if (LIMIT > 0) urls = urls.slice(0, LIMIT);
  console.log(`[scrape] ${urls.length} URL(s) to process`);

  const persons = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const post = await processOne(urls[i], i + 1, urls.length);
      persons.push(post);
    } catch (e) {
      console.log(`FAIL  ${e.message}`);
    }
    if (i < urls.length - 1) await sleep(DELAY_MS);
  }

  const out = {
    site: DEFAULT_SOURCE,
    exported: new Date().toISOString(),
    wp_version: null,
    categories: DEFAULT_CATEGORIES,
    persons,
    uploads: []
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  if (!DRY) fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));

  console.log(`\n[scrape] DONE. persons=${persons.length}`);
  console.log(`[scrape] wrote ${OUT_JSON}${DRY ? ' (SKIPPED, dry run)' : ''}`);
  console.log(`[scrape] photos under ${MEDIA_ROOT}/`);
  console.log(`\nNext:`);
  console.log(`  git add migration/db/lico_export.json public/media`);
  console.log(`  git commit -m "Scraped bios from lichnosty.ru"`);
  console.log(`  git push`);
  console.log(`  # On Render: npm run seed  (will pick up the JSON)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
