import { deepseekGenerate } from '../ai/deepseek-client.js';
import { SITE_NAME } from '../utils/constants.js';

export function defaultMeta(person) {
  const name = person.name;
  const profession = person.profession ? ` — ${person.profession}` : '';
  return {
    title: `${name}${profession} — биография | ${SITE_NAME}`,
    description: person.bio_short ||
      `Полная биография ${name}: детство, карьера, личная жизнь, интересные факты.`,
    keywords: [name, `${name} биография`, 'биография', 'личности']
      .filter(Boolean).join(', ')
  };
}

export async function generateMetaViaAI(person) {
  const r = await deepseekGenerate('seo_meta', {
    name: person.name,
    bio: person.bio_full
  });
  return r.data || defaultMeta(person);
}

export function mergeMeta(existing, generated) {
  return {
    title: existing?.seo_title || generated?.title,
    description: existing?.seo_desc || generated?.description,
    keywords: existing?.seo_keywords || generated?.keywords
  };
}
