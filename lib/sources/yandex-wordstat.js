/**
 * Источник кандидатов из Яндекс.Вордстата.
 *
 * СТАТУС: заглушка. Требует OAuth-токена Яндекс.Директа (где живёт API Wordstat)
 * и квоты отчётов CreateNewWordstatReport. Стандартный Wordstat Report — async,
 * с очередью, сырой JSON-дампом и лимитами в десятки запросов в сутки для
 * общедоступных аккаунтов.
 *
 * TODO:
 *   1. Добавить OAuth flow / взять токен из env YANDEX_WORDSTAT_TOKEN.
 *   2. Реализовать CreateNewWordstatReport('{phrases}', geoId=225 (Россия)).
 *   3. Поллить GetWordstatReport(reportID) каждые 30 сек до статуса Done.
 *   4. Из отчёта вытаскивать связанные запросы вида
 *      "биография <ФИО>" или "<ФИО> личная жизнь" с частотой Shows > N.
 *   5. Нормализовать ФИО, скорить по Shows, вернуть в формате
 *      { name, source: 'wordstat', score }.
 *
 * Пока возвращает пустой результат — aggregator это понимает.
 */

export async function collectWordstatCandidates() {
  if (!process.env.YANDEX_WORDSTAT_TOKEN) {
    return { candidates: [], errors: [{ src: 'wordstat', error: 'YANDEX_WORDSTAT_TOKEN not set' }] };
  }
  // TODO: real implementation
  return { candidates: [], errors: [{ src: 'wordstat', error: 'not_implemented' }] };
}
