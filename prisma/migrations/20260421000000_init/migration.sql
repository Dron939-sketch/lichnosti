-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alt_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intro" TEXT,
    "bio_full" TEXT NOT NULL,
    "bio_short" TEXT NOT NULL,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "videos" JSONB NOT NULL DEFAULT '[]',
    "photo_url" TEXT,
    "birth_date" TIMESTAMP(3),
    "death_date" TIMESTAMP(3),
    "birth_place" TEXT,
    "profession" TEXT,
    "zodiac" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'PUBLISHED',
    "seo_title" TEXT,
    "seo_desc" TEXT,
    "seo_keywords" TEXT,
    "social_links" JSONB NOT NULL DEFAULT '[]',
    "similar_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "source_refs" JSONB NOT NULL DEFAULT '[]',
    "ai_model" TEXT,
    "ai_tokens" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_ai_check" TIMESTAMP(3),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "seo_title" TEXT,
    "seo_desc" TEXT,
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryOnPerson" (
    "person_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "CategoryOnPerson_pkey" PRIMARY KEY ("person_id","category_id")
);

-- CreateTable
CREATE TABLE "GenerationLog" (
    "id" SERIAL NOT NULL,
    "job_id" TEXT,
    "person_id" INTEGER,
    "kind" TEXT NOT NULL,
    "prompt_key" TEXT NOT NULL,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "GenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendCandidate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_slug_key" ON "Person"("slug");

-- CreateIndex
CREATE INDEX "Person_status_updated_at_idx" ON "Person"("status", "updated_at");

-- CreateIndex
CREATE INDEX "Person_created_at_idx" ON "Person"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "CategoryOnPerson_category_id_idx" ON "CategoryOnPerson"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationLog_job_id_key" ON "GenerationLog"("job_id");

-- CreateIndex
CREATE INDEX "GenerationLog_status_created_at_idx" ON "GenerationLog"("status", "created_at");

-- CreateIndex
CREATE INDEX "TrendCandidate_processed_score_idx" ON "TrendCandidate"("processed", "score");

-- CreateIndex
CREATE UNIQUE INDEX "TrendCandidate_name_source_key" ON "TrendCandidate"("name", "source");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOnPerson" ADD CONSTRAINT "CategoryOnPerson_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOnPerson" ADD CONSTRAINT "CategoryOnPerson_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

