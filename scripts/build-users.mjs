// Creates the 5 BuildKhata users (idempotent) with a default password.
// Run once after `npm run db:setup` has created the build_* tables:
//     node scripts/build-users.mjs
// Optionally set a different default password:
//     node scripts/build-users.mjs "myStartPass"
// Users log in, then should change the password in the app (Profile).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(_scrypt);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Put it in .env.local first.");
  process.exit(1);
}

// Same scheme as lib/password.ts -> "scrypt:<saltHex>:<hashHex>"
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

const DEFAULT_PASS = process.argv[2] || "build@123";
const USERS = [
  { username: "rahul", name: "Rahul" },
  { username: "suresh", name: "Suresh" },
  { username: "amit", name: "Amit" },
  { username: "priya", name: "Priya" },
  { username: "vikas", name: "Vikas" },
];

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});
await client.connect();

let created = 0;
for (const u of USERS) {
  const hash = await hashPassword(DEFAULT_PASS);
  const { rowCount } = await client.query(
    `INSERT INTO build_users (username, name, password_hash) VALUES ($1,$2,$3)
     ON CONFLICT (username) DO NOTHING`,
    [u.username, u.name, hash]
  );
  if (rowCount > 0) {
    created++;
    console.log(`  + ${u.name.padEnd(8)} username: ${u.username}`);
  } else {
    console.log(`  · ${u.name.padEnd(8)} already exists (skipped)`);
  }
}

await client.end();
console.log(`\n✓ done — ${created} new user(s). Default password for new users: "${DEFAULT_PASS}"`);
console.log("  Log in at /build/login and change it later.");
