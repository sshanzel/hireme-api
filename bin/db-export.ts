#!/usr/bin/env npx tsx
/**
 * Export all table data to JSON files for seeding
 * Usage: npx tsx bin/db-export.ts
 */
import 'dotenv/config';
import {Pool} from 'pg';
import {writeFileSync, mkdirSync} from 'fs';
import {join} from 'path';

const SEEDS_DIR = join(import.meta.dirname, '..', 'seeds');

async function main() {
  const pool = new Pool({connectionString: process.env.DATABASE_URL});

  // Ensure seeds directory exists
  mkdirSync(SEEDS_DIR, {recursive: true});

  // Get all table names in public schema
  const tablesResult = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE '__drizzle%'
    ORDER BY tablename
  `);

  const tables = tablesResult.rows.map(r => r.tablename);
  console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);

  for (const table of tables) {
    const dataResult = await pool.query(`SELECT * FROM "${table}"`);
    const filePath = join(SEEDS_DIR, `${table}.json`);

    writeFileSync(filePath, JSON.stringify(dataResult.rows, null, 2));
    console.log(`Exported ${dataResult.rows.length} rows from "${table}" to ${table}.json`);
  }

  await pool.end();
  console.log('\nExport complete!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
