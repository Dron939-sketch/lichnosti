export const metadata = {
  title: 'Блог',
  description: 'Полезные статьи портала «Личности».'
};

export default function Page() {
  return (
    <section className="container" style={{ padding: '40px 20px 60px', maxWidth: 760 }}>
      <h1 className="author_title">Блог</h1>
      <p className="was">Полезные статьи</p>
      <p style={{ marginTop: 20 }}>
        Раздел в разработке. Скоро здесь появятся статьи о том, как читать биографии,
        кого включают в наш портал и по каким критериям.
      </p>
    </section>
  );
}
