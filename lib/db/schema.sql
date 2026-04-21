-- Рекомендуется использовать Prisma Migrate (prisma/schema.prisma).
-- Этот файл — справочный SQL для ручного создания схемы.

CREATE TYPE person_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE job_status    AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

CREATE TABLE IF NOT EXISTS person (
  id             SERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  alt_names      TEXT[] NOT NULL DEFAULT '{}',
  bio_full       TEXT NOT NULL,
  bio_short      TEXT NOT NULL,
  photo_url      TEXT,
  birth_date     TIMESTAMPTZ,
  death_date     TIMESTAMPTZ,
  birth_place    TEXT,
  profession     TEXT,
  zodiac         TEXT,
  status         person_status NOT NULL DEFAULT 'PUBLISHED',
  seo_title      TEXT,
  seo_desc       TEXT,
  seo_keywords   TEXT,
  social_links   JSONB NOT NULL DEFAULT '[]',
  similar_ids    INT[] NOT NULL DEFAULT '{}',
  source_refs    JSONB NOT NULL DEFAULT '[]',
  ai_model       TEXT,
  ai_tokens      INT NOT NULL DEFAULT 0,
  views          INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ai_check  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS person_status_updated_idx ON person(status, updated_at);
CREATE INDEX IF NOT EXISTS person_created_idx        ON person(created_at);
CREATE INDEX IF NOT EXISTS person_name_trgm_idx      ON person USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS category (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  seo_title   TEXT,
  seo_desc    TEXT,
  parent_id   INT REFERENCES category(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_on_person (
  person_id   INT NOT NULL REFERENCES person(id)   ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, category_id)
);
CREATE INDEX IF NOT EXISTS cop_category_idx ON category_on_person(category_id);

CREATE TABLE IF NOT EXISTS generation_log (
  id          SERIAL PRIMARY KEY,
  job_id      TEXT UNIQUE,
  person_id   INT,
  kind        TEXT NOT NULL,
  prompt_key  TEXT NOT NULL,
  tokens_in   INT NOT NULL DEFAULT 0,
  tokens_out  INT NOT NULL DEFAULT 0,
  cost_usd    DOUBLE PRECISION NOT NULL DEFAULT 0,
  status      job_status NOT NULL DEFAULT 'QUEUED',
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS generation_log_status_idx ON generation_log(status, created_at);

CREATE TABLE IF NOT EXISTS trend_candidate (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  source     TEXT NOT NULL,
  score      DOUBLE PRECISION NOT NULL DEFAULT 0,
  processed  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, source)
);
CREATE INDEX IF NOT EXISTS trend_candidate_processed_idx ON trend_candidate(processed, score);
