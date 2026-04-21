'use client';

import { useEffect, useRef, useState } from 'react';

export default function InfiniteNext({ nextUrl }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!nextUrl || loaded) return;

    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(async (entries) => {
      const [entry] = entries;
      if (!entry.isIntersecting || loaded) return;
      setLoaded(true);
      io.disconnect();

      try {
        const res = await fetch(nextUrl);
        if (!res.ok) return;
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const next = doc.querySelector('section.catalog');
        if (next) {
          const others = document.querySelector('.other_persons');
          if (others) others.remove();
          el.appendChild(next);
        }
      } catch (e) {
        console.warn('infinite next failed:', e);
      }
    }, { rootMargin: '400px 0px 400px 0px' });

    io.observe(el);
    return () => io.disconnect();
  }, [nextUrl, loaded]);

  if (!nextUrl) return null;
  return <div ref={ref} id="next_post" data-next-url={nextUrl} />;
}
