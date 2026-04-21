export const SITE_URL = process.env.NEXT_PUBLIC_URL || 'https://lichnosty.onrender.com';
export const SITE_NAME = process.env.SITE_NAME || 'Личности';
export const SITE_DESCRIPTION =
  'Биографии известных личностей: актёры, политики, учёные, спортсмены, деятели искусства.';

export const REVALIDATE_SECONDS = {
  home: 60 * 30,
  bio: 60 * 60 * 24,
  category: 60 * 60 * 6,
  sitemap: 60 * 60
};
