// src/db/index.ts
// Clawjin Prism — Database Connection
// Uses Supabase connection pooler (port 6543)

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as typeof globalThis & {
  __prismPool?: Pool;
  __prismDb?: NodePgDatabase<typeof schema>;
};

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  // Throw only when a query is actually attempted (request time), not at module
  // load. This keeps `next build` page-data collection from failing when the
  // env var is not present in the build environment.
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Check your environment variables.");
  }

  return new Pool({
    connectionString: databaseUrl,
    // Supabase pooler requires SSL
    ssl: { rejectUnauthorized: false },
    // Keep low for connection pooler
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

function getPool(): Pool {
  const existing = globalForDb.__prismPool ?? createPool();
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__prismPool = existing;
  }
  return existing;
}

function getDb(): NodePgDatabase<typeof schema> {
  const existing = globalForDb.__prismDb ?? drizzle(getPool(), { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__prismDb = existing;
  }
  return existing;
}

// Lazily resolve the pool/db on first property access so that importing this
// module never connects or throws at build time.
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(getPool(), prop, receiver);
  },
});

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
