'use client';

import Script from 'next/script';

export default function YandexShare({
  services = 'messenger,vkontakte,telegram,twitter,viber,whatsapp'
}) {
  return (
    <>
      <Script src="https://yastatic.net/share2/share.js" strategy="lazyOnload" />
      <div className="ya-share2" data-curtain data-services={services} />
    </>
  );
}
