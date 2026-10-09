import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't load Next's env files; read .env.local if present, else use the environment.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (e.g. CI): DATABASE_URL must come from the environment.
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");

// Plain SQLite dialect: the generated migrations in ./drizzle also apply to Cloudflare D1
// (`wrangler d1 migrations apply`) and Turso. Locally they run against a libsql file.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: databaseUrl },
  strict: true, // ask before destructive changes
});
