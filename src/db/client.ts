import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Lazy singleton — NO top-level env read, so `next build` passes with no
// DATABASE_URL (Phase-4 gate). neon() only runs on first getDb() call.
let _db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — add it to .env.local (Phase 5a · Neon).",
    );
  }
  _db = drizzle(neon(url), { schema });
  return _db;
}

/** Cheap env check used by the auth adapter + (app) layout SetupNotice. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
