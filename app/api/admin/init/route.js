import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/init  (Bearer CRON_SECRET)
 *
 * Разворачивает схему Prisma на пустой БД, выполняя SQL из
 * prisma/migrations/<init>/migration.sql. Идемпотентна — повторные
 * вызовы не делают вреда (CREATE ... IF NOT EXISTS для индексов и
 * ALTER TABLE ... IF NOT EXISTS ... для ограничений, а ошибки
 * "already exists" мы ловим и игнорируем).
 *
 * Нужно для free-tier Render, где Shell недоступен.
 */
export async function POST(request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return NextResponse.json({ error: 'migrations dir missing' }, { status: 500 });
  }

  const dirs = fs.readdirSync(migrationsDir)
    .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
    .sort();

  const applied = [];
  const errors = [];

  for (const d of dirs) {
    const sqlPath = path.join(migrationsDir, d, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by ';' at statement end, ignore comments and empty lines.
    const statements = splitSqlStatements(sql);

    for (const stmt of statements) {
      try {
        await db.$executeRawUnsafe(stmt);
        applied.push({ migration: d, stmt: oneLine(stmt).slice(0, 120) });
      } catch (e) {
        const msg = String(e?.message || e);
        if (/already exists|duplicate object|duplicate key/i.test(msg)) {
          applied.push({ migration: d, stmt: oneLine(stmt).slice(0, 120), skipped: true });
        } else {
          errors.push({ migration: d, stmt: oneLine(stmt).slice(0, 200), error: msg });
        }
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    applied: applied.length,
    errors
  });
}

function splitSqlStatements(sql) {
  const cleaned = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const parts = [];
  let buf = '';
  let inStr = false;
  let dollar = false;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (dollar) {
      buf += c;
      if (c === '$' && cleaned[i + 1] === '$') { dollar = false; buf += '$'; i++; }
      continue;
    }
    if (!inStr && c === '$' && cleaned[i + 1] === '$') {
      dollar = true;
      buf += '$$';
      i++;
      continue;
    }
    if (c === "'") inStr = !inStr;
    if (!inStr && c === ';') {
      const s = buf.trim();
      if (s) parts.push(s);
      buf = '';
    } else {
      buf += c;
    }
  }
  const tail = buf.trim();
  if (tail) parts.push(tail);
  return parts;
}

function oneLine(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}
