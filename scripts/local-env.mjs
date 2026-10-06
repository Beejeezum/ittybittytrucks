import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function createLocalEnv(directory) {
  await mkdir(directory, { recursive: true });
  const sqlite = new DatabaseSync(path.join(directory, 'site.sqlite'));
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  const migrations = fileURLToPath(new URL('../drizzle/', import.meta.url));
  for (const name of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
    if (!sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name)) {
      sqlite.exec('BEGIN');
      try { sqlite.exec(await readFile(path.join(migrations, name), 'utf8')); sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(name); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  }
  function statement(sql, args = []) {
    const query = sqlite.prepare(sql);
    return {
      bind(...values) { return statement(sql, values); },
      async first() { return query.get(...args) || null; },
      async all() { return { success: true, results: query.all(...args), meta: {} }; },
      async run() { const result = query.run(...args); return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; },
    };
  }
  const env = {
    OWNER_EMAIL: 'preview-owner@example.invalid',
    DB: {
      prepare: statement,
      async batch(queries) {
        sqlite.exec('BEGIN');
        try { const result = []; for (const query of queries) result.push(await query.all()); sqlite.exec('COMMIT'); return result; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      },
    },
    BUCKET: {
      async put(key, body) { const file = path.join(directory, 'objects', key); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, new Uint8Array(body)); return { key }; },
      async get(key) { try { const body = await readFile(path.join(directory, 'objects', key)); return { body }; } catch (error) { if (error.code === 'ENOENT') return null; throw error; } },
      async delete(key) { await rm(path.join(directory, 'objects', key), { force: true }); },
    },
  };
  return { env, sqlite, close: () => sqlite.close() };
}
