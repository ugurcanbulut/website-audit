const { readFileSync, readdirSync } = require('fs');
const { join } = require('path');

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  // Dynamic import for the postgres ESM module
  const postgres = require('postgres');
  const sql = postgres(connectionString, { max: 1 });

  // Create migrations tracking table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  const migrationsDir = join(__dirname, 'drizzle');
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
    const existing = await sql`SELECT 1 FROM drizzle_migrations WHERE hash = ${hash}`;
    if (existing.length > 0) {
      console.log(`Migration ${file} already applied, skipping.`);
      continue;
    }

    console.log(`Applying migration: ${file}`);
    const content = readFileSync(join(migrationsDir, file), 'utf-8');

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
