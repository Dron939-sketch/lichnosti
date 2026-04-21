import './globals.css';
import Link from 'next/link';
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from '@/lib/utils/constants';
import { buildWebsiteSchema } from '@/lib/seo/schema-builder';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — биографии известных людей`,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'ru_RU',
    url: SITE_URL,
    title: `${SITE_NAME} — биографии известных людей`,
    description: SITE_DESCRIPTION
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION
  },
  alternates: { canonical: SITE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' }
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebsiteSchema()) }}
        />
        <header className="site-header">
          <div className="container inner">
            <Link href="/" className="site-logo">{SITE_NAME}</Link>
            <nav className="site-nav" aria-label="Главное меню">
              <ul>
                <li><Link href="/">Главная</Link></li>
                <li><Link href="/category/aktyory">Актёры</Link></li>
                <li><Link href="/category/muzyka">Музыка</Link></li>
                <li><Link href="/category/sport">Спорт</Link></li>
                <li><Link href="/category/nauka">Наука</Link></li>
              </ul>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="container">
            <p>
              © {new Date().getFullYear()} {SITE_NAME}. Биографический портал.
              Материалы формируются с участием ИИ и проходят редакторскую проверку.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
