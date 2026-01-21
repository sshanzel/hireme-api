#!/usr/bin/env npx tsx
/**
 * Reset database: drop all tables and run migrations
 * Usage: npx tsx bin/db-reset.ts
 */
import 'dotenv/config';
import {Pool} from 'pg';
import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

async function main() {
  const pool = new Pool({connectionString: process.env.DATABASE_URL});

  console.log('Dropping all tables...');

  // Drop all tables in the public schema
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);

  // Also drop drizzle migration tracking table if exists
  await pool.query(`DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE;`);

  await pool.end();

  console.log('All tables dropped.');
  console.log('Pushing schema...');

  // Note: Using drizzle-kit push instead of migrate because migrate has issues
  // applying SQL files properly. Push directly syncs schema to database.
  const {stdout, stderr} = await execAsync('pnpm drizzle-kit push --force');
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);

  console.log('Database reset complete! Schema pushed successfully.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
