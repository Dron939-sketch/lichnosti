import Link from 'next/link';

export const metadata = {
  title: 'Страница не найдена',
  robots: { index: false, follow: false }
};

export default function NotFound() {
  return (
    <section className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 72, margin: 0 }}>404</h1>
      <p style={{ color: '#5b5b5b', marginTop: 8 }}>Такой биографии у нас пока нет.</p>
      <p><Link href="/">← На главную</Link></p>
    </section>
  );
}
