import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '@/lib/db';
import { importFromJson } from '@/lib/migrate/json-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/import  (Bearer CRON_SECRET)
 *
 * Импортирует migration/db/lico_export.json в Postgres.
 * Идемпотентна — все операции upsert по slug.
 *
 * Query params:
 *   - file=<path>  кастомный путь к JSON (по умолчанию migration/db/lico_export.json)
 */
export async function POST(request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const relPath = url.searchParams.get('file') || 'migration/db/lico_export.json';
  const absPath = path.isAbsolute(relPath) ? relPath : path.join(process.cwd(), relPath);

  if (!fs.existsSync(absPath)) {
    return NextResponse.json({ error: 'file_not_found', path: absPath }, { status: 404 });
  }

  try {
    const result = await importFromJson({ db, jsonPath: absPath, logger: console });
    return NextResponse.json({
      ok: result.persons.failed === 0,
      ...result
    });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
