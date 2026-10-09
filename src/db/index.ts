import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";

const wrap = (client: Client) => drizzle({ client, schema, casing: "snake_case" });

/** A Drizzle client for a libsql URL (`file:local.db`, `:memory:`, or a Turso URL). */
export function createDb(url: string) {
  return wrap(createClient({ url }));
}

export type Database = ReturnType<typeof createDb>;

// Next's dev server re-evaluates modules on every edit. Only the *connection* is cached on
// globalThis (so edits don't open a new one each time); the Drizzle wrapper is rebuilt per module
// evaluation so it always uses the current schema. Caching the whole Drizzle instance kept the
// pre-edit schema alive and broke queries after a column rename.
const globalForDb = globalThis as unknown as { libsqlClient?: Client };
let db: Database | undefined;

/** The app's shared client, from DATABASE_URL. (Cloudflare D1 would use drizzle-orm/d1 here.) */
export function getDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  globalForDb.libsqlClient ??= createClient({ url });
  db ??= wrap(globalForDb.libsqlClient);
  return db;
}
