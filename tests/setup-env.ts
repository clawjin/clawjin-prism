// Load .env.local before any test imports run (db/index.ts requires
// DATABASE_URL at import time).
import { config } from "dotenv";

config({ path: ".env.local" });
