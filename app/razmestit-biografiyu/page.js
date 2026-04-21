export const metadata = {
  title: 'Разместить биографию',
  description: 'Как разместить биографию на портале «Личности».'
};

export default function Page() {
  return (
    <section className="container" style={{ padding: '40px 20px 60px', maxWidth: 760 }}>
      <h1 className="author_title">Разместить биографию</h1>
      <p className="was">Добавьте героя в наш каталог</p>

      <p style={{ marginTop: 20 }}>
        Если вы хотите предложить персону для публикации на портале, напишите нам на{' '}
        <a href="mailto:editor@lichnosty.ru">editor@lichnosty.ru</a> с темой
        «Биография: &lt;ФИО&gt;». В письме укажите:
      </p>
      <ul>
        <li>ФИО, дата и место рождения</li>
        <li>Сфера деятельности, ключевые достижения</li>
        <li>Ссылки на публичные источники (Wikipedia, СМИ, соцсети)</li>
        <li>Контакт для уточнений</li>
      </ul>
      <p>
        Мы публикуем только персон российской, советской или русскоязычной
        публичной сферы.
      </p>
    </section>
  );
}
