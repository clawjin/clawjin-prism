// drizzle.config.ts
import * as dotenv from "dotenv";

// Load DATABASE_URL from whichever env file provides it. Next.js dev uses
// `.env.development.local`, CI/local often uses `.env.local`, and it may also
// already be present in the process environment (e.g. on Vercel). dotenv does
// not overwrite variables that are already set, so ordering is safe.
for (const path of [".env.local", ".env.development.local", ".env"]) {
  dotenv.config({ path });
}

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL not found. Set it in the environment or in .env.local / .env.development.local.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema:  "./src/db/schema.ts",
  out:     "./drizzle",
  dbCredentials: {
    url: databaseUrl,
    ssl: true,
  },
  verbose: true,
  strict:  false,
});
