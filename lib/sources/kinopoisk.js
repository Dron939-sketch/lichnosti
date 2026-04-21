/**
 * Источник кандидатов из Кинопоиска.
 *
 * СТАТУС: заглушка. Официального публичного API нет; есть неофициальные
 * обёртки через RapidAPI (kinopoisk.dev, kinopoiskapiunofficial.tech).
 *
 * TODO:
 *   1. Взять ключ из env: KINOPOISK_API_KEY / RAPIDAPI_KEY.
 *   2. Для kinopoisk.dev:
 *      GET https://api.kinopoisk.dev/v1.4/movie?year=${currentYear}&sortField=releaseDate&sortType=-1
 *      → из каждого фильма брать persons[] с role 'actor' / 'director'.
 *   3. Для каждого person.name — если persons.enProfession === 'actor' и
 *      persons.profession === 'актер' (т.е. именно российский — признак:
 *      наличие русского имени и отсутствие ссылки на IMDb вне кириллицы),
 *      скорить как 0.4 + (movies_count / 10).
 *   4. Отфильтровать уже существующих в Person.
 *
 * Пока возвращает пустой результат — aggregator это понимает.
 */

export async function collectKinopoiskCandidates() {
  if (!process.env.KINOPOISK_API_KEY && !process.env.RAPIDAPI_KEY) {
    return { candidates: [], errors: [{ src: 'kinopoisk', error: 'KINOPOISK_API_KEY not set' }] };
  }
  // TODO: real implementation
  return { candidates: [], errors: [{ src: 'kinopoisk', error: 'not_implemented' }] };
}
