import './globals.css';
import Link from 'next/link';
import HeaderNav from '@/components/HeaderNav';
import Analytics from '@/components/Analytics';
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
  },
  verification: {
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebsiteSchema()) }}
        />
        <Analytics />

        <header className="header">
          <div className="container">
            <HeaderNav />
          </div>
        </header>

        <main className="wrapper">{children}</main>

        <footer>
          <div className="container">
            <div className="butn">
              <Link href="/razmestit-biografiyu" className="btn">Разместить биографию</Link>
              <Link href="/svyazatsya-s-nami" className="btn btn_small">Связаться с нами</Link>
            </div>
            <ul className="social" />
            <div className="copyright">
              <p>© {SITE_NAME} {new Date().getFullYear()}</p>
              <p>Полное или частичное копирование материалов сайта разрешено только с указанием ссылки</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
