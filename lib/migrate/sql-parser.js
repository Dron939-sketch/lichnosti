/**
 * Минималистичный потоковый парсер mysqldump-SQL.
 * Достаёт INSERT INTO <table> VALUES (...), (...);
 *
 * Ограничения:
 * - Поддерживает стандартный mysqldump-формат (default + extended-insert).
 * - Не исполняет DDL, не понимает SELECT и т.п.
 * - Строковые экранирования: \n \t \r \\ \' \" \0
 * - NULL → null, числа → Number, остальное — string.
 */
import fs from 'node:fs';
import readline from 'node:readline';
import zlib from 'node:zlib';

function isDumpGzip(path) {
  return path.endsWith('.gz') || path.endsWith('.gzip');
}

function openStream(filePath) {
  const raw = fs.createReadStream(filePath);
  return isDumpGzip(filePath) ? raw.pipe(zlib.createGunzip()) : raw;
}

/**
 * Async iterator that yields { table, columns, rows } for each INSERT statement.
 * Columns may be null if the INSERT didn't specify them.
 *
 * Usage:
 *   for await (const insert of iterateInserts('dump.sql.gz')) { ... }
 */
export async function* iterateInserts(filePath, { onlyTables = null } = {}) {
  const stream = openStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const tablesFilter = onlyTables ? new Set(onlyTables) : null;

  let buf = '';
  let inInsert = false;

  for await (const line of rl) {
    if (!inInsert) {
      if (!/^INSERT INTO\s+/i.test(line)) continue;
      // Optionally filter by table name
      const mTbl = line.match(/^INSERT INTO\s+`?([^`\s(]+)`?/i);
      if (tablesFilter && mTbl && !tablesFilter.has(mTbl[1])) continue;
      buf = line;
      inInsert = true;
    } else {
      buf += '\n' + line;
    }

    // Statement is terminated by ';' OUTSIDE of a string. Fast path:
    if (endsWithStatement(buf)) {
      const parsed = parseInsertStatement(buf);
      buf = '';
      inInsert = false;
      if (parsed) {
        if (tablesFilter && !tablesFilter.has(parsed.table)) continue;
        yield parsed;
      }
    }
  }
}

function endsWithStatement(s) {
  // Scan from end, making sure the final ';' is not inside a quoted string.
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === "'") { inStr = false; continue; }
    } else {
      if (c === "'") { inStr = true; continue; }
      if (c === ';' && i === s.length - 1) return true;
    }
  }
  return false;
}

export function parseInsertStatement(stmt) {
  // INSERT INTO `table` [(col,col,...)] VALUES (...), (...);
  const m = stmt.match(/^INSERT INTO\s+`?([^`\s(]+)`?\s*(\(([^)]*)\))?\s*VALUES\s+([\s\S]+);\s*$/i);
  if (!m) return null;
  const table = m[1];
  const colsRaw = m[3];
  const columns = colsRaw
    ? colsRaw.split(',').map((c) => c.trim().replace(/^`|`$/g, ''))
    : null;
  const valuesText = m[4];
  const rows = parseRows(valuesText);
  return { table, columns, rows };
}

function parseRows(s) {
  const rows = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(s[i])) i++;
    if (i >= n) break;
    if (s[i] !== '(') { i++; continue; }
    i++;
    const { values, newIndex } = parseTuple(s, i);
    rows.push(values);
    i = newIndex;
  }
  return rows;
}

function parseTuple(s, i) {
  const vals = [];
  const n = s.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(s[i])) i++;
    if (s[i] === ')') return { values: vals, newIndex: i + 1 };

    if (s[i] === "'") {
      // string
      i++;
      let str = '';
      while (i < n) {
        const c = s[i];
        if (c === '\\' && i + 1 < n) {
          const nx = s[i + 1];
          const tbl = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0' };
          str += tbl[nx] !== undefined ? tbl[nx] : nx;
          i += 2;
          continue;
        }
        if (c === "'") { i++; break; }
        str += c;
        i++;
      }
      vals.push(str);
    } else {
      // bare token: number / NULL / identifier
      let tok = '';
      while (i < n && s[i] !== ',' && s[i] !== ')') { tok += s[i]; i++; }
      tok = tok.trim();
      if (tok === '') { /* skip */ }
      else if (tok === 'NULL' || tok === 'null') vals.push(null);
      else if (/^-?\d+$/.test(tok)) vals.push(Number(tok));
      else if (/^-?\d+\.\d+$/.test(tok)) vals.push(Number(tok));
      else vals.push(tok);
    }
  }
  return { values: vals, newIndex: i };
}

/**
 * Convert rows + optional columns into an array of plain objects.
 * When columns is null (happens with mysqldump default), pass a schema.
 */
export function rowsToObjects(rows, columns, schemaFallback = null) {
  const cols = columns || schemaFallback;
  if (!cols) throw new Error('No column names available');
  return rows.map((row) => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i] ?? null; });
    return obj;
  });
}

/**
 * Default WP schemas for tables we care about. Used when mysqldump omits
 * the column list (the common --complete-insert=no case).
 */
export const WP_SCHEMAS = {
  wp_posts: [
    'ID','post_author','post_date','post_date_gmt','post_content','post_title',
    'post_excerpt','post_status','comment_status','ping_status','post_password',
    'post_name','to_ping','pinged','post_modified','post_modified_gmt',
    'post_content_filtered','post_parent','guid','menu_order','post_type',
    'post_mime_type','comment_count'
  ],
  wp_postmeta: ['meta_id','post_id','meta_key','meta_value'],
  wp_terms: ['term_id','name','slug','term_group'],
  wp_term_taxonomy: ['term_taxonomy_id','term_id','taxonomy','description','parent','count'],
  wp_term_relationships: ['object_id','term_taxonomy_id','term_order']
};
