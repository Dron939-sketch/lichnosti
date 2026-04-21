import axios from 'axios';

const WIKI_API = 'https://ru.wikipedia.org/w/api.php';
const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const STOP_TITLE_RE = /^(Шаблон:|Категория:|Портал:|Википедия:|Файл:|Служебная:|Список|Список .*)/i;

function formatRuDate(d = new Date()) {
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()]}`;
}

async function fetchCategoryMembers(categoryTitle, limit = 50) {
  const { data } = await axios.get(WIKI_API, {
    timeout: 20_000,
    params: {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Категория:${categoryTitle}`,
      cmlimit: limit,
      cmnamespace: 0,
      format: 'json',
      origin: '*'
    },
    headers: { 'User-Agent': 'LichnostyBot/0.1 (https://lichnosty.onrender.com)' }
  });
  return data?.query?.categorymembers || [];
}

async function fetchPageInfo(titles) {
  if (!titles.length) return [];
  const { data } = await axios.get(WIKI_API, {
    timeout: 20_000,
    params: {
      action: 'query',
      prop: 'extracts|info|categories',
      exintro: 1,
      explaintext: 1,
      titles: titles.slice(0, 50).join('|'),
      cllimit: 10,
      inprop: 'url',
      format: 'json',
      origin: '*'
    },
    headers: { 'User-Agent': 'LichnostyBot/0.1 (https://lichnosty.onrender.com)' }
  });
  const pages = data?.query?.pages || {};
  return Object.values(pages);
}

const FOREIGN_HINTS = [
  'американск', 'британск', 'английск', 'немецк', 'французск',
  'итальянск', 'испанск', 'японск', 'китайск', 'корейск',
  'индийск', 'турецк', 'арабск', 'бразильск', 'мексиканск',
  'австралийск', 'канадск', 'польск', 'финск', 'шведск',
  'норвежск', 'голландск', 'нидерландск', 'бельгийск', 'швейцарск',
  'иранск', 'израильск', 'греческ', 'венгерск', 'чешск', 'румынск'
];
const RU_HINTS = [
  'российск', 'русск', 'советск', 'ссср', 'рсфср', 'российской империи',
  'росси', 'москв', 'петербург', 'ленинград', 'киев', 'минск',
  'одесс', 'ростов', 'казан', 'новосибирск', 'урал', 'сибир'
];

function classifyByExtract(extract = '') {
  const lc = extract.toLowerCase();
  const foreign = FOREIGN_HINTS.some((w) => lc.includes(w));
  const russian = RU_HINTS.some((w) => lc.includes(w));
  if (russian && !foreign) return 'russian';
  if (russian && foreign) return 'mixed';
  if (foreign) return 'foreign';
  return 'unknown';
}

export async function birthdayPersonsToday({ date = new Date(), maxCandidates = 30 } = {}) {
  const ruDate = formatRuDate(date);
  const raw = await fetchCategoryMembers(`Родившиеся ${ruDate}`, 100);
  const titles = raw
    .map((m) => m.title)
    .filter((t) => t && !STOP_TITLE_RE.test(t));

  const infos = await fetchPageInfo(titles.slice(0, 50));
  const scored = [];
  for (const page of infos) {
    const cls = classifyByExtract(page.extract || '');
    if (cls === 'foreign') continue;
    const score = (cls === 'russian' ? 1.0 : cls === 'mixed' ? 0.5 : 0.3);
    scored.push({
      name: page.title,
      source: 'wikipedia-ru:birthday',
      score,
      url: page.fullurl || `https://ru.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      extract: (page.extract || '').slice(0, 400)
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCandidates);
}

export async function deathAnniversaryToday({ date = new Date(), maxCandidates = 10 } = {}) {
  const ruDate = formatRuDate(date);
  const raw = await fetchCategoryMembers(`Умершие ${ruDate}`, 50);
  const titles = raw.map((m) => m.title).filter((t) => !STOP_TITLE_RE.test(t));
  const infos = await fetchPageInfo(titles.slice(0, 40));
  const out = [];
  for (const p of infos) {
    const cls = classifyByExtract(p.extract || '');
    if (cls === 'foreign') continue;
    out.push({
      name: p.title,
      source: 'wikipedia-ru:death-anniv',
      score: cls === 'russian' ? 0.8 : 0.3,
      url: p.fullurl,
      extract: (p.extract || '').slice(0, 400)
    });
  }
  return out.slice(0, maxCandidates);
}
