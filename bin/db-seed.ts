#!/usr/bin/env npx tsx
/**
 * Seed database from JSON files
 * Usage: npx tsx bin/db-seed.ts
 */
import 'dotenv/config';
import {Pool} from 'pg';
import {readFileSync, readdirSync, existsSync} from 'fs';
import {join} from 'path';

const SEEDS_DIR = join(import.meta.dirname, '..', 'seeds');

// Tables in order of insertion (respecting foreign key constraints)
// Parent tables first, then dependent tables
const TABLE_ORDER = [
  'user',
  'experience',
  'file',
  'user_parsed_archive',
  'story_raw',
  'story_raw_event',
  'story',
  'story_index',
];

async function main() {
  if (!existsSync(SEEDS_DIR)) {
    console.error('Seeds directory not found. Run db-export first.');
    process.exit(1);
  }

  const pool = new Pool({connectionString: process.env.DATABASE_URL});

  // Get available seed files
  const seedFiles = readdirSync(SEEDS_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${seedFiles.length} seed files`);

  // Sort by table order to respect foreign keys
  const sortedFiles = seedFiles.sort((a, b) => {
    const tableA = a.replace('.json', '');
    const tableB = b.replace('.json', '');
    const indexA = TABLE_ORDER.indexOf(tableA);
    const indexB = TABLE_ORDER.indexOf(tableB);
    // Unknown tables go to the end
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  for (const file of sortedFiles) {
    const table = file.replace('.json', '');
    const filePath = join(SEEDS_DIR, file);
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));

    if (data.length === 0) {
      console.log(`Skipping "${table}" (no data)`);
      continue;
    }

    // Get column names from first row
    const columns = Object.keys(data[0]);
    const columnList = columns.map(c => `"${c}"`).join(', ');

    // Build parameterized insert
    let insertedCount = 0;
    for (const row of data) {
      const values = columns.map(c => row[c]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      try {
        await pool.query(
          `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
        insertedCount++;
      } catch (err: any) {
        console.error(`Error inserting into "${table}":`, err.message);
      }
    }

    console.log(`Seeded ${insertedCount}/${data.length} rows into "${table}"`);
  }

  await pool.end();
  console.log('\nSeeding complete!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
