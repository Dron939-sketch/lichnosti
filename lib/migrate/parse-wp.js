import { load } from 'cheerio';

const ZODIAC_SIGNS = [
  ['Козерог',   [12, 22], [1, 19]],
  ['Водолей',   [1, 20],  [2, 18]],
  ['Рыбы',      [2, 19],  [3, 20]],
  ['Овен',      [3, 21],  [4, 19]],
  ['Телец',     [4, 20],  [5, 20]],
  ['Близнецы',  [5, 21],  [6, 21]],
  ['Рак',       [6, 22],  [7, 22]],
  ['Лев',       [7, 23],  [8, 22]],
  ['Дева',      [8, 23],  [9, 22]],
  ['Весы',      [9, 23],  [10, 23]],
  ['Скорпион',  [10, 24], [11, 22]],
  ['Стрелец',   [11, 23], [12, 21]]
];

export function zodiacFromDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(+d)) return null;
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  for (const [name, from, to] of ZODIAC_SIGNS) {
    if (m === from[0] && day >= from[1]) return name;
    if (m === to[0]   && day <= to[1])   return name;
  }
  return null;
}

export function parseRuDate(s) {
  if (!s) return null;
  if (s instanceof Date) return isNaN(+s) ? null : s;
  if (typeof s !== 'string') return null;
  const t = s.trim();
  let m;
  // DD.MM.YYYY
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return toDate(m[3], m[2], m[1]);
  // YYYY-MM-DD
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return toDate(m[1], m[2], m[3]);
  // DD-MM-YYYY
  m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return toDate(m[3], m[2], m[1]);
  // "2 декабря 1991"
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  m = t.toLowerCase().match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})$/);
  if (m) {
    const mo = months.indexOf(m[2]);
    if (mo >= 0) return toDate(m[3], mo + 1, m[1]);
  }
  return null;
}

function toDate(y, m, d) {
  const dt = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00Z`);
  return isNaN(+dt) ? null : dt;
}

const META_ALIASES = {
  name:        ['name', 'fio', 'full_name', 'imia'],
  birth_date:  ['birth_date', 'date_birth', 'dob', 'data_rozhdeniya', 'birthday'],
  death_date:  ['death_date', 'date_death', 'data_smerti'],
  birth_place: ['birth_place', 'place_birth', 'mesto_rozhdeniya'],
  profession:  ['profession', 'occupation', 'professiya', 'rabota', 'was'],
  zodiac:      ['zodiac', 'znak_zodiaka', 'znak'],
  photo:       ['photo_url', 'photo', 'main_photo', 'foto', 'image']
};

function pickMeta(meta, aliases) {
  for (const key of aliases) {
    if (meta[key] !== undefined && meta[key] !== null && meta[key] !== '') return meta[key];
    const prefixed = `_${key}`;
    if (meta[prefixed] !== undefined) return meta[prefixed];
  }
  return null;
}

function collectSocialLinks(meta) {
  const links = [];
  const socialKeys = ['telegram','tg','vk','vkontakte','youtube','yt','instagram','ig','facebook','fb','tiktok','tt','ok','odnoklassniki','twitter','x','dzen','rutube'];
  for (const k of socialKeys) {
    const v = meta[k] ?? meta[`_${k}`] ?? meta[`social_${k}`];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) {
      links.push({ network: k, url: v });
    }
  }
  // also scan meta for any https://t.me, vk.com, etc.
  const seen = new Set(links.map((l) => l.url));
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v !== 'string') continue;
    const m = v.match(/https?:\/\/(t\.me|vk\.com|youtu\.be|youtube\.com|instagram\.com|facebook\.com|tiktok\.com|ok\.ru|twitter\.com|x\.com|dzen\.ru|rutube\.ru)\/[^\s"'<>]+/i);
    if (m && !seen.has(m[0])) {
      seen.add(m[0]);
      links.push({ network: new URL(m[0]).hostname, url: m[0] });
    }
  }
  return links;
}

/**
 * Parse WordPress post_content into structured sections by splitting on <h2>.
 * Falls back to returning the whole content as a single intro section.
 */
export function contentToSections(html) {
  if (!html) return { intro: '', sections: [] };
  const $ = load(`<div id="root">${html}</div>`);
  const root = $('#root');

  // Remove Elementor-only nav_link_bio anchor block (we'll regenerate)
  root.find('.nav_link_bio').remove();

  const sections = [];
  let intro = '';
  let currentTitle = null;
  let currentId = null;
  let currentChunks = [];
  let introChunks = [];

  root.children().each((_, el) => {
    const $el = $(el);
    const tag = el.tagName?.toLowerCase();

    if (tag === 'h2') {
      if (currentTitle) {
        sections.push({
          anchor_id: currentId || slugifyAnchor(currentTitle),
          title: currentTitle,
          html: currentChunks.join('\n').trim()
        });
      }
      currentTitle = $el.text().trim();
      currentId = $el.attr('id') ? slugifyAnchor($el.attr('id')) : null;
      currentChunks = [];
    } else if (currentTitle !== null) {
      currentChunks.push($.html($el));
    } else {
      introChunks.push($.html($el));
    }
  });
  if (currentTitle) {
    sections.push({
      anchor_id: currentId || slugifyAnchor(currentTitle),
      title: currentTitle,
      html: currentChunks.join('\n').trim()
    });
  }

  const introHtml = introChunks.join('\n').trim();
  // Try to extract a short intro: first <p>
  const $intro = load(`<div>${introHtml}</div>`);
  const firstP = $intro('p').first().text().trim();
  intro = firstP || introHtml.replace(/<[^>]+>/g, '').trim().slice(0, 400);

  return { intro, sections, rawBio: html };
}

export function slugifyAnchor(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => {
      const map = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
      return map[c] ?? '';
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';
}

/**
 * Normalize a single WordPress post export into our Person shape.
 */
export function normalizePerson(post) {
  const meta = post.meta || {};
  const name = post.title || pickMeta(meta, META_ALIASES.name) || '';
  const slug = post.slug || null;

  const birthDate = parseRuDate(pickMeta(meta, META_ALIASES.birth_date));
  const deathDate = parseRuDate(pickMeta(meta, META_ALIASES.death_date));

  const { intro, sections, rawBio } = contentToSections(post.content || '');

  const photoUrl = post.thumbnail || pickMeta(meta, META_ALIASES.photo) || null;
  const photos = Array.isArray(post.attachments)
    ? post.attachments.filter((a) => /^image\//.test(a.mime || '')).map((a) => a.url).filter(Boolean)
    : [];

  return {
    wp_id: post.id,
    slug,
    name,
    intro,
    bio_full: rawBio,
    bio_short: (post.excerpt || intro || '').replace(/<[^>]+>/g, '').trim().slice(0, 280),
    sections,
    photos,
    photo_url: photoUrl,
    birth_date: birthDate,
    death_date: deathDate,
    birth_place: pickMeta(meta, META_ALIASES.birth_place) || null,
    profession: pickMeta(meta, META_ALIASES.profession) || null,
    zodiac: pickMeta(meta, META_ALIASES.zodiac) || zodiacFromDate(birthDate),
    social_links: collectSocialLinks(meta),
    categories: Array.isArray(post.categories) ? post.categories : [],
    created_at: post.date ? new Date(post.date) : new Date(),
    updated_at: post.modified ? new Date(post.modified) : new Date()
  };
}
