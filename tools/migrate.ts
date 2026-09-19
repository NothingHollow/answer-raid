import { readFile } from 'node:fs/promises';
import { database } from '../server/db.ts';

const sql = database();
const statements = (await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'))
  .split(';').map(s => s.trim()).filter(Boolean);
await sql.transaction(statements.map(statement => sql.query(statement)));
console.log('Leaderboard schema is ready.');
