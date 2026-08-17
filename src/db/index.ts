import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Local databases (127.0.0.1 / localhost) don't use TLS. Hosted providers
// (Neon, Supabase, RDS) require SSL — enable it automatically for those.
const isLocal = /localhost|127\.0\.0\.1|::1/.test(databaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __clawjinPostgresPool?: Pool;
};

export const pool =
  globalForDb.__clawjinPostgresPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__clawjinPostgresPool = pool;
}

export const db = drizzle(pool);
