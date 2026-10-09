import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

/** A Drizzle client for a libsql URL (`file:local.db`, `:memory:`, or a Turso URL). */
export function createDb(url: string) {
  return drizzle({ client: createClient({ url }), schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDb>;

// One client per process. Next's dev server re-evaluates modules on every edit, so the client is
// cached on globalThis instead of a module variable to avoid opening a new connection each time.
const globalForDb = globalThis as unknown as { db?: Database };

/** The app's shared client, from DATABASE_URL. (Cloudflare D1 would use drizzle-orm/d1 here.) */
export function getDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  globalForDb.db ??= createDb(url);
  return globalForDb.db;
}
