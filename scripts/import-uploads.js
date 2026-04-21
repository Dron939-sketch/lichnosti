#!/usr/bin/env node
/**
 * Перенос wp-content/uploads в public/media и обновление URL-ов в записях Person.
 *
 * Usage:
 *   node scripts/import-uploads.js migration/uploads [--strip-variants] [--dry]
 *
 * Опции:
 *   --strip-variants   удалить файлы вида -123x456.jpg, -scaled.jpg (оставить оригиналы)
 *   --dry              не копировать, только вывести план
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../lib/db/index.js';

const STRIP = process.argv.includes('--strip-variants');
const DRY = process.argv.includes('--dry');

const SRC_ROOT = path.resolve(process.argv[2] || 'migration/uploads');
const DST_ROOT = path.resolve('public/media');
const WP_BASEURL_PATTERNS = [
  /https?:\/\/(?:www\.)?lichnosty\.ru\/wp-content\/uploads\//gi,
  /https?:\/\/lichnosty\.onrender\.com\/wp-content\/uploads\//gi
];

function isVariantFile(name) {
  return /-\d+x\d+\.(jpg|jpeg|png|webp|gif)$/i.test(name) ||
         /-scaled\.(jpg|jpeg|png|webp|gif)$/i.test(name) ||
         /-thumbnail\.(jpg|jpeg|png|webp|gif)$/i.test(name);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function copyFiles() {
  if (!fs.existsSync(SRC_ROOT)) {
    console.error(`Source not found: ${SRC_ROOT}`);
    process.exit(1);
  }
  fs.mkdirSync(DST_ROOT, { recursive: true });

  const files = walk(SRC_ROOT);
  let copied = 0, skipped = 0, bytes = 0;

  for (const full of files) {
    const rel = path.relative(SRC_ROOT, full);
    const base = path.basename(rel);

    if (STRIP && isVariantFile(base)) { skipped++; continue; }

    const dst = path.join(DST_ROOT, rel);
    if (DRY) {
      copied++;
      bytes += fs.statSync(full).size;
      continue;
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(full, dst);
    copied++;
    bytes += fs.statSync(full).size;
  }

  console.log(`[uploads] files: total=${files.length} copied=${copied} skipped_variants=${skipped}`);
  console.log(`[uploads] bytes: ${(bytes / (1024 * 1024)).toFixed(1)} MB`);
}

function rewriteContent(html) {
  if (!html || typeof html !== 'string') return html;
  let out = html;
  for (const re of WP_BASEURL_PATTERNS) out = out.replace(re, '/media/');
  return out;
}

function rewriteValue(v) {
  if (typeof v === 'string') return rewriteContent(v);
  if (Array.isArray(v)) return v.map(rewriteValue);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = rewriteValue(val);
    return out;
  }
  return v;
}

async function rewriteUrls() {
  const persons = await db.person.findMany({
    select: { id: true, slug: true, bio_full: true, intro: true, bio_short: true,
              sections: true, photos: true, photo_url: true, social_links: true }
  });
  console.log(`[uploads] rewriting URLs in ${persons.length} persons`);

  let touched = 0;
  for (const p of persons) {
    const update = {};
    if (p.bio_full && p.bio_full.includes('wp-content/uploads/')) update.bio_full = rewriteContent(p.bio_full);
    if (p.intro && p.intro.includes('wp-content/uploads/'))       update.intro   = rewriteContent(p.intro);
    if (p.photo_url && p.photo_url.includes('wp-content/uploads/')) update.photo_url = rewriteContent(p.photo_url);
    if (Array.isArray(p.photos) && JSON.stringify(p.photos).includes('wp-content/uploads/')) {
      update.photos = rewriteValue(p.photos);
    }
    if (p.sections && JSON.stringify(p.sections).includes('wp-content/uploads/')) {
      update.sections = rewriteValue(p.sections);
    }
    if (!Object.keys(update).length) continue;

    if (DRY) { touched++; continue; }
    await db.person.update({ where: { id: p.id }, data: update });
    touched++;
  }
  console.log(`[uploads] persons touched: ${touched}`);
}

async function main() {
  console.log(`[uploads] src=${SRC_ROOT} dst=${DST_ROOT} strip=${STRIP} dry=${DRY}`);
  await copyFiles();
  await rewriteUrls();
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
