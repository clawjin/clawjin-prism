// drizzle.config.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL not found in .env.local");
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