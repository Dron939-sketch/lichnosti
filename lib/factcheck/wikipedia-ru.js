import axios from 'axios';

const WIKI_API = 'https://ru.wikipedia.org/w/api.php';
const UA = 'LichnostyBot/0.1 (https://lichnosty.onrender.com)';

async function wikiGet(params) {
  const { data } = await axios.get(WIKI_API, {
    timeout: 20_000,
    params: { format: 'json', origin: '*', ...params },
    headers: { 'User-Agent': UA }
  });
  return data;
}

export async function searchWikipedia(name) {
  const data = await wikiGet({
    action: 'query',
    list: 'search',
    srsearch: name,
    srlimit: 5
  });
  return data?.query?.search?.map((r) => r.title) || [];
}

export async function fetchWikipediaExtract(title) {
  const data = await wikiGet({
    action: 'query',
    prop: 'extracts|info|pageprops',
    titles: title,
    exintro: 0,
    explaintext: 1,
    inprop: 'url'
  });
  const pages = data?.query?.pages || {};
  const first = Object.values(pages)[0];
  if (!first || first.missing) return null;
  return {
    title: first.title,
    url: first.fullurl,
    extract: first.extract || '',
    disambig: !!(first.pageprops?.disambiguation)
  };
}

/**
 * Best-effort fetch of the Wikipedia page for a given person name.
 * Prefers exact title match; falls back to first non-disambiguation search hit.
 */
export async function resolveWikipediaPage(name) {
  // 1. Try exact title
  const exact = await fetchWikipediaExtract(name);
  if (exact && !exact.disambig && exact.extract && exact.extract.length > 200) {
    return exact;
  }

  // 2. Search
  const candidates = await searchWikipedia(name);
  for (const t of candidates) {
    const page = await fetchWikipediaExtract(t);
    if (!page) continue;
    if (page.disambig) continue;
    if (!page.extract || page.extract.length < 200) continue;
    return page;
  }
  return null;
}
