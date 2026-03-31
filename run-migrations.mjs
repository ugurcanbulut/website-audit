import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function migrate() {
  // Create migrations tracking table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  const migrationsDir = join(process.cwd(), 'drizzle');
  let files;
  try {
    files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch {
    console.log('No migrations directory found, skipping.');
    await sql.end();
    return;
  }

  for (const file of files) {
    const hash = file;
    // Check if already applied
    const existing = await sql`SELECT 1 FROM drizzle_migrations WHERE hash = ${hash}`;
    if (existing.length > 0) {
      console.log(`Migration ${file} already applied, skipping.`);
      continue;
    }

    console.log(`Applying migration: ${file}`);
    const content = readFileSync(join(migrationsDir, file), 'utf-8');

    // Split by statement breakpoints (Drizzle uses --> statement-breakpoint)
    const statements = content
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    await sql`INSERT INTO drizzle_migrations (hash) VALUES (${hash})`;
    console.log(`Migration ${file} applied successfully.`);
  }

  await sql.end();
  console.log('All migrations complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
