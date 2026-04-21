# Личности — саморазвивающийся SEO-портал биографий

Автономный Next.js 14 (App Router) сайт, который сам генерирует биографии известных личностей
через DeepSeek API, оптимизирует SEO, строит внутреннюю перелинковку и обновляет устаревшие страницы.

Развёртывается одним файлом `render.yaml` на [Render.com](https://render.com).

## Тематика — только русские/советские персоны

Портал публикует биографии **исключительно русских, советских и русскоязычных публичных фигур**
(граждане и выходцы России, СССР, СНГ, Российской империи; деятели русской культуры).

Перед каждой генерацией воркер вызывает промпт `validate_russian` —
DeepSeek проверяет персону и возвращает `{is_russian, category_hint, reason}`.
Если `false` — задача помечается как `FAILED` c причиной `rejected:not_russian`,
биография не создаётся, токены не тратятся на бесполезную генерацию.
Источники трендов дополнительно фильтруются эвристикой по тексту вступления
из русской Википедии (см. `lib/sources/wikipedia-ru.js`).

## Стек

- **Next.js 14** (App Router, ISR, standalone output)
- **PostgreSQL** (Neon / Render) + **Prisma**
- **Redis** (Upstash / Render) + **BullMQ** — очередь задач
- **DeepSeek API** — генерация текстов
- **Docker** — `web` и `worker` образы
- **Cron-задачи** на Render — планировщик

## Структура

```
lichnosty-selfwriting/
├── app/
│   ├── page.js                         # Главная (ISR)
│   ├── bio/[slug]/page.js              # Биография (ISR)
│   ├── category/[slug]/page.js         # Категория (ISR)
│   ├── sitemap.xml/route.js            # Динамический sitemap
│   ├── robots.txt/route.js             # robots
│   ├── api/
│   │   ├── health/route.js             # health-check для Render
│   │   ├── revalidate/route.js         # Инвалидация кэша ISR
│   │   ├── cron/
│   │   │   ├── generate-daily/route.js
│   │   │   ├── update-stale/route.js
│   │   │   └── rebuild-sitemap/route.js
│   │   └── webhook/deepseek-callback/route.js
│   ├── layout.js, globals.css, not-found.js
├── lib/
│   ├── db/           # Prisma клиент + SQL-схема
│   ├── redis.js
│   ├── ai/           # DeepSeek клиент, промпты, очередь, кэш, rate-limit
│   ├── seo/          # meta-generator, schema-builder (JSON-LD), internal-links
│   ├── scheduler/    # enqueueDailyGeneration, enqueueStaleUpdates
│   └── utils/        # slugify (RU→EN), constants
├── prisma/schema.prisma
├── scripts/
│   ├── seed-initial.js         # Начальные 10+ биографий
│   ├── migrate-wordpress.js    # Миграция с lichnosty.ru (WP REST API)
│   └── cron-daily.js           # Триггер cron
├── worker.js                   # BullMQ воркер (entrypoint)
├── Dockerfile, Dockerfile.worker
├── render.yaml                 # Инфраструктура как код
└── package.json
```

## Локальный запуск

```bash
# 1. Установить зависимости
npm install

# 2. Скопировать переменные окружения
cp .env.example .env.local
# Отредактировать DATABASE_URL, REDIS_URL, DEEPSEEK_API_KEY

# 3. Применить схему БД
npx prisma db push

# 4. Запустить Next.js
npm run dev            # http://localhost:3000

# 5. В отдельном терминале — воркер
npm run worker

# 6. Засеять первые биографии
npm run seed
```

## Деплой на Render

1. Форкните / создайте репозиторий и запушьте этот код.
2. В Render Dashboard → **New → Blueprint** → укажите репозиторий.
   Render прочитает `render.yaml` и создаст:
   - `lichnosty-web` (Next.js, Docker)
   - `lichnosty-worker` (BullMQ, Docker)
   - `lichnosty-cron-daily` и `lichnosty-cron-stale` (cron)
   - `lichnosty-db` (PostgreSQL)
   - `lichnosty-redis` (Redis)
3. В **Environment** для `lichnosty-web` и `lichnosty-worker` вручную задайте
   `DEEPSEEK_API_KEY` (взять на [platform.deepseek.com](https://platform.deepseek.com)).
4. Для cron-сервисов добавьте `CRON_SECRET` с тем же значением, что
   у `lichnosty-web` (Render сгенерирует его автоматически — скопируйте).
5. После первого деплоя — применить Prisma-схему:
   ```bash
   # в Render Shell сервиса lichnosty-web
   npx prisma db push
   ```
6. Засеять данные:
   ```bash
   # в Render Shell сервиса lichnosty-worker
   node scripts/seed-initial.js
   ```

## Как работает автономность

### Источники кандидатов (Trends)
Cron `lichnosty-cron-populate` (01:00 UTC) → `/api/cron/populate-trends`
→ `runCollectAndSave()` опрашивает источники и наполняет `TrendCandidate`:
- **Wikipedia ru — "Родившиеся %d %B"**: 50+ человек, родившихся в сегодняшнюю дату.
  Фильтр по intro-экстракту — только русскоязычные (эвристика по словам-маркерам).
- **Wikipedia ru — "Умершие %d %B"**: аналогично для дня смерти (анонсы).
- (планируется) Яндекс.Вордстат, Кинопоиск, RSS TASS/Lenta/RIA.

Дедупликация по slug; персоны, уже есть в `Person`, пропускаются.

### Ежедневная генерация
Cron `lichnosty-cron-daily` (02:00 UTC) → POST `/api/cron/generate-daily`
→ `enqueueDailyGeneration()` берёт топ-N из `TrendCandidate` и ставит в BullMQ
→ воркер **сначала валидирует через `validate_russian`**, при отказе — SKIP,
иначе генерирует биографию + SEO-мета + краткое описание + похожих персон
→ сохраняет в `Person`, инвалидирует ISR через `/api/revalidate`.

### Обновление устаревших
Cron `lichnosty-cron-stale` (вс, 03:00 UTC) → `/api/cron/update-stale`
→ выбирает `Person` с `last_ai_check` старше 90 дней
→ запускает `update`-задачи в очереди.

### SEO
- JSON-LD `Person`, `BreadcrumbList`, `WebSite` в каждой странице.
- Динамический `sitemap.xml` с `lastmod`.
- Внутренняя перелинковка: `addInternalLinks()` сканирует биографию
  и заменяет упоминания других персон на `<a href="/bio/...">`.
- Блок "Читайте также" в конце каждой биографии.
- ISR: страницы перегенерируются при изменении БД или по времени.
- IndexNow-пинг при обновлении sitemap (если задан `INDEXNOW_KEY`).

### Экономия на API
- Все ответы DeepSeek кэшируются в Redis (SHA1 от payload) на 7 дней.
- Rate limiter: не более `DEEPSEEK_RPM` запросов в минуту (по умолчанию 10).
- BullMQ throttle: `limiter: { max: 10, duration: 60_000 }`.

## Миграция с текущего WordPress

Старый сайт — WordPress с темой [`Leshiypos/lico`](https://github.com/Leshiypos/lico),
CPT `lico`, таксономия `lico_cat`.

```bash
# 1. Создать Application Password в WP-админке
#    Users → Profile → Application Passwords
# 2. Положить в .env:
#    WP_SOURCE_URL=https://lichnosty.ru
#    WP_APP_USER=your_login
#    WP_APP_PASSWORD=xxxx xxxx xxxx xxxx
# 3. Запустить
npm run migrate
```

Скрипт пройдёт по `/wp-json/wp/v2/lico` и `/wp-json/wp/v2/lico_cat`,
импортирует посты и категории в Postgres. Работает в `upsert` — можно
запускать повторно.

## ТЗ и статус

Базовый каркас по ТЗ №2 готов:

- [x] Архитектура `web + worker + cron + redis + postgres` на Render
- [x] Prisma-схема: `Person`, `Category`, `CategoryOnPerson`, `GenerationLog`, `TrendCandidate`
- [x] DeepSeek клиент с кэшем, rate-limit, парсингом JSON-ответов
- [x] Промпты: `full_bio`, `seo_meta`, `short_bio`, `similar_persons`, `has_new_info`, `fact_check`
- [x] BullMQ очередь `bio-generation` с задачами `generate` / `update`
- [x] Автоматическая внутренняя перелинковка
- [x] JSON-LD Schema.org (`Person`, `BreadcrumbList`, `WebSite`)
- [x] Динамический `sitemap.xml` и `robots.txt`
- [x] Cron-эндпоинты `generate-daily`, `update-stale`, `rebuild-sitemap`
- [x] Webhook для DeepSeek callback
- [x] Health-check и `/api/revalidate`
- [x] Dockerfile для web и worker, `render.yaml`
- [x] Скрипты: `seed-initial`, `migrate-wordpress`, `cron-daily`
- [x] Базовая тема оформления (Playfair Display + Georgia, золотой акцент)
- [x] Russian-only гейт (`validate_russian` перед каждой генерацией)
- [x] Источник трендов Wikipedia ru (именинники + юбилеи смерти)
- [x] CI workflow (GitHub Actions, сборка на каждый PR)

## Что ещё нужно доделать по ТЗ

- [ ] Дополнительные источники трендов (Яндекс.Вордстат, Кинопоиск, RSS TASS/Lenta).
      Сейчас работает только Wikipedia ru.
- [ ] Fact-check постпроцессинг через Wikipedia API (промпт `fact_check` уже есть).
- [ ] Google Indexing API и IndexNow (ключ — в env).
- [ ] Страница поиска (`/search`).
- [ ] Админ-панель / страница статистики `GenerationLog`.

## Бюджет (ежемесячно)

| Сервис | План | ~$ |
|---|---|---|
| Render Web (starter) | free tier, 750h | $0 |
| Render Worker (starter) | free tier, 750h | $0 |
| PostgreSQL (Neon free) | 0.5 GB | $0 |
| Redis (Render free) | 25 MB | $0 |
| DeepSeek API | ~1M токенов | ~$0.5 |

**Итого: $0.5–2** при 3 генерациях в день.
