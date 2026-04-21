import slugifyLib from 'slugify';

const RU_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya'
};

function transliterate(str) {
  return str
    .toLowerCase()
    .split('')
    .map((ch) => (RU_MAP[ch] !== undefined ? RU_MAP[ch] : ch))
    .join('');
}

export function slugify(name) {
  if (!name) return '';
  const translit = transliterate(String(name));
  return slugifyLib(translit, { lower: true, strict: true, trim: true });
}

export default slugify;
