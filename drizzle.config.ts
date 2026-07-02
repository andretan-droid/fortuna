import { defineConfig } from "drizzle-kit";

// DATABASE_URL is injected by the db:* scripts via `node --env-file=.env.local`.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
