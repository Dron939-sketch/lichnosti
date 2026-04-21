import axios from 'axios';
import { load } from 'cheerio';

const DEFAULT_UA = 'LichnostyMigrationBot/1.0 (+https://github.com/Dron939-sketch/lichnosti)';

export async function fetchHtml(url, { userAgent = DEFAULT_UA, timeout = 30_000 } = {}) {
  const { data } = await axios.get(url, {
    timeout,
    headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' },
    responseType: 'text'
  });
  return data;
}

/**
 * Parse a single `/bio/<slug>/` page of lichnosty.ru (theme `lico`)
 * into the same "wp-post-like" shape that export-from-wordpress.php produces.
 * Consumable by lib/migrate/parse-wp.js::normalizePerson and scripts/import-from-json.js.
 */
export function parseBioHtml(html, url) {
  const $ = load(html);

  // --- Yoast JSON-LD graph (dates, canonical image) ---
  let ld = null;
  try { ld = JSON.parse($('script.yoast-schema-graph').text()); } catch { /* noop */ }
  const webPage   = ld?.['@graph']?.find((n) => n['@type'] === 'WebPage');
  const imageObj  = ld?.['@graph']?.find((n) => n['@type'] === 'ImageObject');

  // --- Basics ---
  const canonical = $('link[rel="canonical"]').attr('href') || url;
  const slug = canonical.replace(/\/+$/, '').split('/').pop();
  const title = $('h1.author_title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
  const profession = $('p.was').first().text().trim();
  const excerpt = $('meta[name="description"]').attr('content')
    || $('meta[property="og:description"]').attr('content')
    || '';

  // --- Left column meta fields (h6 label + p value) ---
  const meta = {};
  $('.card_left.descop .author_info ul > li').each((_, li) => {
    const $li = $(li);
    const label = $li.find('h6').first().text().trim().toLowerCase();
    const value = $li.find('> p').first().text().trim();
    if (!label || !value) return;
    if (label === 'имя')               meta.name = value;
    else if (label === 'дата рождения') meta.birth_date = value;
    else if (label === 'дата смерти')   meta.death_date = value;
    else if (label === 'место рождения') meta.birth_place = value;
    else if (label === 'по зодиаку')    meta.zodiac = value;
  });
  if (profession) { meta.profession = profession; meta.was = profession; }

  // --- Social links (skip PHP-warning garbage hrefs starting with "<") ---
  const socialPatterns = [
    ['telegram',  /t\.me/i],
    ['vk',        /vk\.com/i],
    ['youtube',   /youtu/i],
    ['instagram', /instagram\.com/i],
    ['facebook',  /facebook\.com/i],
    ['ok',        /ok\.ru/i],
    ['tiktok',    /tiktok\.com/i],
    ['twitter',   /(twitter|x)\.com/i],
    ['rutube',    /rutube\.ru/i],
    ['dzen',      /dzen\.ru/i]
  ];
  $('.card_left.descop .social_link a[href]').each((_, a) => {
    const href = ($(a).attr('href') || '').trim();
    if (!href || href.startsWith('<') || !/^https?:\/\//.test(href)) return;
    for (const [key, re] of socialPatterns) {
      if (re.test(href) && !meta[key]) { meta[key] = href; break; }
    }
  });
  const siteHref = $('.card_left.descop a.site_link[href]').first().attr('href');
  if (siteHref && /^https?:/.test(siteHref)) meta.site = siteHref;

  // --- Thumbnail ---
  let thumbnail = null;
  const photoStyle = $('.card_left.descop .author_photo').attr('style') || '';
  const m = photoStyle.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  if (m) thumbnail = m[1].trim();
  if (!thumbnail && imageObj?.url) thumbnail = imageObj.url;
  if (!thumbnail) thumbnail = $('meta[property="og:image"]').attr('content') || null;

  // --- Gallery from "Фото" tab ---
  const attachments = [];
  $('.tab_photo .items_photos a[href]').each((_, a) => {
    const href = $(a).attr('href');
    if (!href || !/^https?:/.test(href)) return;
    const alt = $(a).attr('data-caption') || '';
    attachments.push({ url: href, mime: guessMime(href), alt: alt.trim() });
  });

  // --- Bio content: drop nav, ads, scripts. Convert <div id="Section">
  //     <p><strong>Section</strong></p>...</div> into <h2>Section</h2>... ---
  const $bio = $('.tab_content .tab_bio').first().clone();
  $bio.find('.nav_link_bio, .adv_block, .adv_block_pers, script, style').remove();

  $bio.find('div[id]').each((_, div) => {
    const $div = $(div);
    // First paragraph with <strong> text is the section heading
    const $firstP = $div.children('p').first();
    const headingText = $firstP.find('strong').first().text().trim();
    if (!headingText) return;
    $firstP.remove();
    const inner = $div.html() || '';
    $div.replaceWith(`<h2>${escapeHtml(headingText)}</h2>\n${inner}`);
  });

  let content = ($bio.html() || '').trim();
  // Normalise whitespace
  content = content.replace(/\n{3,}/g, '\n\n');

  // --- Category: active item in main menu ---
  const categories = [];
  $('#nav_main_menu li.current-lico-ancestor a, #nav_main_menu li.current-menu-parent a, #nav_main_menu li.current-lico-parent a')
    .each((_, a) => {
      const href = ($(a).attr('href') || '').match(/\/type\/([^\/]+)/);
      if (href && !categories.includes(href[1])) categories.push(href[1]);
    });

  // --- Dates ---
  const date     = webPage?.datePublished || $('meta[property="article:published_time"]').attr('content') || null;
  const modified = webPage?.dateModified  || $('meta[property="article:modified_time"]').attr('content')  || null;

  return {
    id: null,
    slug,
    title,
    content,
    excerpt,
    status: 'publish',
    date,
    modified,
    author_id: null,
    guid: canonical,
    categories,
    meta,
    thumbnail,
    thumbnail_id: null,
    attachments
  };
}

export async function scrapeBio(url, opts = {}) {
  const html = await fetchHtml(url, opts);
  return parseBioHtml(html, url);
}

function guessMime(u) {
  const ext = u.toLowerCase().split('?')[0].split('.').pop();
  return {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', avif: 'image/avif'
  }[ext] || 'image/jpeg';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
