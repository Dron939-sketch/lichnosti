export const metadata = {
  title: 'Связаться с нами',
  description: 'Контактная информация редакции портала «Личности».'
};

export default function Page() {
  return (
    <section className="container" style={{ padding: '40px 20px 60px', maxWidth: 760 }}>
      <h1 className="author_title">Связаться с нами</h1>
      <p className="was">Редакция, партнёрство, жалобы</p>

      <p style={{ marginTop: 20 }}>
        Общий контакт редакции:{' '}
        <a href="mailto:editor@lichnosty.ru">editor@lichnosty.ru</a>
      </p>
      <p>
        Если вы обнаружили фактическую ошибку или хотите предложить корректировку —
        напишите нам с темой письма «Правка: &lt;ФИО&gt;», указав URL страницы и
        источник.
      </p>
    </section>
  );
}
