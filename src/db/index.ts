// src/db/index.ts
// Clawjin Prism — Database Connection
// Uses Supabase connection pooler (port 6543)

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Check your .env.local file.");
}

const globalForDb = globalThis as typeof globalThis & {
  __prismPool?: Pool;
};

export const pool =
  globalForDb.__prismPool ??
  new Pool({
    connectionString: databaseUrl,
    // Supabase pooler requires SSL
    ssl: { rejectUnauthorized: false },
    // Keep low for connection pooler
    max: 3,
    idleTimeoutMillis:    30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__prismPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };