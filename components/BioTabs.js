'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

export default function BioTabs({ sections, bioHtml, photos = [], videos = [] }) {
  const [active, setActive] = useState('bio');
  const hasPhotos = Array.isArray(photos) && photos.length > 0;
  const hasVideos = Array.isArray(videos) && videos.length > 0;

  useEffect(() => {
    if (active === 'photo' && hasPhotos && typeof window !== 'undefined' && window.Fancybox) {
      window.Fancybox.bind('[data-fancybox="gallery"]', {});
    }
  }, [active, hasPhotos]);

  const sectionList = Array.isArray(sections) && sections.length > 0
    ? sections.filter((s) => s && (s.title || s.html))
    : null;

  return (
    <>
      {hasPhotos && (
        <>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.css"
          />
          <Script
            src="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0/dist/fancybox/fancybox.umd.js"
            strategy="lazyOnload"
          />
        </>
      )}

      <ul className="tabs" role="tablist">
        <li>
          <a
            href="#"
            className={`tab ${active === 'bio' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActive('bio'); }}
          >
            Биография
          </a>
        </li>
        {hasPhotos && (
          <li>
            <a
              href="#"
              className={`tab ${active === 'photo' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setActive('photo'); }}
            >
              Фото
            </a>
          </li>
        )}
        {hasVideos && (
          <li>
            <a
              href="#"
              className={`tab ${active === 'video' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setActive('video'); }}
            >
              Видео
            </a>
          </li>
        )}
      </ul>

      <div className="tab_content">
        <div className={`tab tab_bio ${active === 'bio' ? 'tab_active' : ''}`}>
          {sectionList && sectionList.length > 0 ? (
            <>
              <div className="nav_link_bio">
                {sectionList.map((s, i) => (
                  <a key={i} href={`#sec-${s.anchor_id || i}`}>
                    {s.title}
                  </a>
                ))}
              </div>
              {sectionList.map((s, i) => (
                <div key={i} id={`sec-${s.anchor_id || i}`}>
                  <h2>{s.title}</h2>
                  <div dangerouslySetInnerHTML={{ __html: s.html || '' }} />
                </div>
              ))}
            </>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: bioHtml || '' }} />
          )}
        </div>

        {hasPhotos && (
          <div className={`tab tab_photo ${active === 'photo' ? 'tab_active' : ''}`}>
            <div className="items_photos">
              {photos.map((src, i) => (
                <a key={i} href={src} data-fancybox="gallery">
                  <img src={src} alt="" loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        )}

        {hasVideos && (
          <div className={`tab tab_video ${active === 'video' ? 'tab_active' : ''}`}>
            {videos.map((v, i) => (
              <div key={i} style={{ aspectRatio: '16/9', marginBottom: 16 }}>
                <iframe
                  src={v}
                  style={{ width: '100%', height: '100%', border: 0, borderRadius: 8 }}
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
