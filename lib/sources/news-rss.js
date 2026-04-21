import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const UA = 'LichnostyBot/0.1 (https://lichnosty.onrender.com)';

const FEEDS = [
  { name: 'TASS',  url: 'https://tass.ru/rss/v2.xml' },
  { name: 'Lenta', url: 'https://lenta.ru/rss/news' },
  { name: 'RIA',   url: 'https://ria.ru/export/rss2/index.xml' }
];

// Common Russian given name prefixes — used to reduce false positives.
// (Not exhaustive; acts as a positive signal.)
const GIVEN_NAME_PREFIXES = [
  'Александр','Алексей','Анатолий','Андрей','Антон','Аркадий','Артур','Арсений',
  'Борис','Вадим','Валентин','Валерий','Василий','Виктор','Виталий','Владимир','Владислав','Вячеслав',
  'Геннадий','Георгий','Герман','Григорий','Дмитрий','Евгений','Егор','Захар',
  'Иван','Игорь','Илья','Кирилл','Константин','Лев','Леонид','Максим','Марк','Матвей','Михаил',
  'Никита','Николай','Олег','Павел','Пётр','Петр','Роман','Ростислав','Руслан','Сергей',
  'Станислав','Степан','Тимур','Фёдор','Федор','Юрий','Ярослав',
  'Алина','Алла','Альбина','Анастасия','Анжелика','Анна','Валентина','Валерия','Варвара','Вера',
  'Виктория','Галина','Дарья','Диана','Екатерина','Елена','Елизавета','Жанна','Зинаида','Инна',
  'Ирина','Карина','Кристина','Ксения','Лариса','Любовь','Людмила','Маргарита','Марина','Мария',
  'Надежда','Наталья','Нина','Оксана','Ольга','Полина','Раиса','Светлана','Софья','Татьяна','Юлия','Яна'
];

const NAME_SET = new Set(GIVEN_NAME_PREFIXES);

// Blacklist for capitalized word pairs that look like names but aren't.
const STOPWORDS = new Set([
  'Москва','Россия','Украина','Беларусь','Казахстан','Кремль','Госдума','Совет','Совета','Федерация',
  'США','Китай','Европа','Германия','Франция','Великобритания','Италия','Турция','Япония',
  'МИД','ФСБ','МВД','ООН','НАТО','ЕС','СССР','РФ','РСФСР','РПЦ','РАН','МГУ','СПбГУ',
  'Вчера','Сегодня','Завтра','Пятница','Суббота','Воскресенье','Понедельник','Вторник','Среда','Четверг'
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true
});

export async function fetchFeed(url) {
  const { data } = await axios.get(url, {
    timeout: 15_000,
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, */*' },
    responseType: 'text'
  });
  const obj = parser.parse(data);
  const items = obj?.rss?.channel?.item || obj?.feed?.entry || [];
  return (Array.isArray(items) ? items : [items]).map((it) => ({
    title: stripTags(it.title?.['#text'] ?? it.title ?? ''),
    description: stripTags(it.description?.['#text'] ?? it.description ?? it.summary ?? '')
  }));
}

function stripTags(s) {
  return String(s || '').replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/<[^>]+>/g, ' ').trim();
}

/**
 * Extract "Имя Фамилия" pairs from text using positive heuristic:
 * - Both words start with a Russian capital.
 * - First word is in GIVEN_NAME_PREFIXES (reduces false positives).
 * - Neither word is a stopword.
 */
export function extractPersonNames(text) {
  if (!text) return [];
  const out = new Set();
  const re = /([А-ЯЁ][а-яё]+)(?:\s+(?:[А-ЯЁ][а-яё]+\s+)?)([А-ЯЁ][а-яё]+)/g;
  let m;
  while ((m = re.exec(text))) {
    const first = m[1];
    const last = m[2];
    if (!NAME_SET.has(first)) continue;
    if (STOPWORDS.has(first) || STOPWORDS.has(last)) continue;
    if (first.length < 3 || last.length < 4) continue;
    out.add(`${first} ${last}`);
  }
  return Array.from(out);
}

export async function collectNewsCandidates({ maxPerFeed = 100 } = {}) {
  const freq = new Map();
  const sources = new Map();
  const errors = [];

  await Promise.all(FEEDS.map(async (f) => {
    try {
      const items = await fetchFeed(f.url);
      const chunk = items.slice(0, maxPerFeed);
      for (const it of chunk) {
        const text = `${it.title} ${it.description}`;
        const names = extractPersonNames(text);
        for (const n of names) {
          freq.set(n, (freq.get(n) || 0) + 1);
          const set = sources.get(n) || new Set();
          set.add(f.name);
          sources.set(n, set);
        }
      }
    } catch (e) {
      errors.push({ feed: f.name, error: e.message });
    }
  }));

  const candidates = [];
  for (const [name, count] of freq.entries()) {
    if (count < 1) continue;
    const srcs = Array.from(sources.get(name) || []);
    // Score: frequency across feeds + bonus for multiple sources
    const score = Math.min(1.0, 0.2 + count * 0.1 + srcs.length * 0.15);
    candidates.push({
      name,
      source: `news-rss:${srcs.join(',')}`,
      score,
      count
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return { candidates, errors };
}
