'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

const MENU = [
  { slug: 'znamenitosti', name: 'Знаменитости' },
  { slug: 'obrazovanie', name: 'Образование' },
  { slug: 'sport',       name: 'Спорт' },
  { slug: 'gosudarstvo', name: 'Государство' },
  { slug: 'biznes',      name: 'Бизнес' },
  { slug: 'blogery',     name: 'Блогеры' },
  { slug: 'eksperty',    name: 'Эксперты' }
];

export default function HeaderNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <div className="mobile_header">
        <Link href="/" className="logo" aria-label="Главная">
          <img src="/logo.svg" alt="Личности" />
        </Link>
        <svg
          id="but_menu"
          width="30"
          height="30"
          viewBox="0 0 30 30"
          fill="none"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Меню"
          role="button"
        >
          <path d="M28.125 13.125H1.875C0.839 13.125 0 13.964 0 15s0.839 1.875 1.875 1.875H28.125C29.161 16.875 30 16.036 30 15s-0.839-1.875-1.875-1.875Z" fill="#111"/>
          <path d="M1.875 8.125H28.125C29.161 8.125 30 7.286 30 6.25S29.161 4.375 28.125 4.375H1.875C0.839 4.375 0 5.214 0 6.25s0.839 1.875 1.875 1.875Z" fill="#111"/>
          <path d="M28.125 21.875H1.875C0.839 21.875 0 22.714 0 23.75s0.839 1.875 1.875 1.875H28.125c1.036 0 1.875-0.839 1.875-1.875s-0.839-1.875-1.875-1.875Z" fill="#111"/>
        </svg>
      </div>

      <nav id="nav_main_menu" className={menuOpen ? 'open' : ''} aria-label="Главное меню">
        <div className="menu-menu-1-container">
          <ul className="menu">
            {MENU.map((m) => {
              const href = `/type/${m.slug}`;
              const active = pathname === href ? 'current-menu-item' : '';
              return (
                <li key={m.slug} className={`menu-item ${active}`}>
                  <Link href={href}>{m.name}</Link>
                </li>
              );
            })}
            <li className="menu-item">
              <Link href="/poleznye-stati">Блог</Link>
            </li>
          </ul>
        </div>

        <Link href="/razmestit-biografiyu" className="btn">Разместить биографию</Link>
        <Link href="/svyazatsya-s-nami" className="btn btn_small">Связаться с нами</Link>

        <div className={`search_icon ${searchOpen ? 'open' : ''}`} onClick={() => setSearchOpen((v) => !v)}>
          <svg id="search_icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 513 513" role="img" aria-label="Поиск">
            <path d="M504.35 459.06l-99.43-99.48c74.4-99.42 54.11-240.34-45.31-314.74S119.26-9.28 44.86 90.15-9.26 330.49 90.17 404.9c79.87 59.77 189.57 59.77 269.43 0l99.48 99.48c12.5 12.5 32.77 12.5 45.27 0s12.5-32.77 0-45.27ZM225.72 385.7c-88.37 0-160-71.63-160-160s71.63-160 160-160 160 71.63 160 160-71.58 159.91-160 160Z" fill="currentColor"/>
          </svg>
          <form action="/" method="GET" onClick={(e) => e.stopPropagation()}>
            <input type="text" name="s" placeholder="Чью биографию изучим?" />
          </form>
        </div>

        <ul className="social" />
      </nav>
    </>
  );
}
