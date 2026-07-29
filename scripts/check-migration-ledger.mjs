import { readdir, readFile } from "node:fs/promises";

const directory = new URL("../supabase/migrations/", import.meta.url);
const lockUrl = new URL("../supabase/migration-lock.json", import.meta.url);
const local = (await readdir(directory))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const lock = JSON.parse(await readFile(lockUrl, "utf8"));

if (!Array.isArray(lock.migrations) || lock.migrations.some((name) => typeof name !== "string")) {
  throw new Error("migration_lock_invalid");
}
const malformed = local.filter((name) => !/^\d{12,14}_[a-z0-9_]+\.sql$/.test(name));
if (malformed.length > 0) throw new Error(`migration_names_invalid:${malformed.join(",")}`);
if (new Set(local).size !== local.length) throw new Error("migration_names_duplicate");

const locked = [...lock.migrations].sort();
if (JSON.stringify(local) !== JSON.stringify(locked)) {
  const missingLocally = locked.filter((name) => !local.includes(name));
  const missingFromLock = local.filter((name) => !locked.includes(name));
  throw new Error(JSON.stringify({
    code: "migration_lock_drift",
    missingLocally,
    missingFromLock,
  }));
}

console.log(`Migration ledger passed (${local.length} ordered migrations).`);
