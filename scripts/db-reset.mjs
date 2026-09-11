// scripts/db-reset.mjs
// DESTRUCTIVE: drops everything in public schema and recreates from migrations.
// Usage: node scripts/db-reset.mjs
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log("Dropping public + drizzle schemas...");
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("GRANT ALL ON SCHEMA public TO current_user");
  await pool.query("GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role").catch(() => {});
  console.log("Schemas dropped. Run `npm run db:migrate` to recreate.");
} finally {
  await pool.end();
}
