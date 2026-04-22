#!/usr/bin/env node
/**
 * Импорт биографий из JSON-дампа (формат scripts/export-from-wordpress.php).
 *
 * Usage:
 *   node scripts/import-from-json.js migration/db/lico_export.json
 */
import 'dotenv/config';
import { db } from '../lib/db/index.js';
import { importFromJson, writeIdMapping } from '../lib/migrate/json-import.js';

async function main() {
  const inputPath = process.argv[2] || 'migration/db/lico_export.json';
  const result = await importFromJson({ db, jsonPath: inputPath });
  console.log('\n[import] DONE');
  console.log('  categories:', result.categories);
  console.log('  persons:   ', result.persons);
  if (result.errors.length) {
    console.log('  errors:');
    for (const e of result.errors) console.log('    -', e);
  }
  const mapPath = writeIdMapping(inputPath, result.wp_id_to_db_id);
  console.log(`[import] wrote id mapping: ${mapPath}`);
  await db.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
