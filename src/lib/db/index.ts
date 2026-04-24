import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Pool configuration tuned for a single Next.js instance + worker + dashboard
// traffic. The previous singleton had no settings and leaked connections
// across Next.js HMR restarts in dev.
const DEFAULT_MAX = 20;
const DEFAULT_IDLE_TIMEOUT = 20;

// Lazy initialization: Next.js build loads every API route module to collect
// page data. If we throw on missing DATABASE_URL at module load, the build
// dies even though the URL is available at runtime. Defer the check until
// the first actual query.

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

declare global {

  var __ui_audit_pg_client: ReturnType<typeof postgres> | undefined;

  var __ui_audit_db: DrizzleDb | undefined;
}

function initClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_MAX || DEFAULT_MAX),
    idle_timeout: Number(
      process.env.DATABASE_IDLE_TIMEOUT || DEFAULT_IDLE_TIMEOUT,
    ),
    prepare: false,
  });
}

function getDb(): DrizzleDb {
  if (!globalThis.__ui_audit_db) {
    globalThis.__ui_audit_pg_client =
      globalThis.__ui_audit_pg_client ?? initClient();
    globalThis.__ui_audit_db = drizzle(globalThis.__ui_audit_pg_client, {
      schema,
    });
  }
  return globalThis.__ui_audit_db;
}

// Proxy to the drizzle client; every method access triggers lazy init.
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
