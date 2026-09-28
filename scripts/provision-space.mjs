import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { createInterface, emitKeypressEvents } from "node:readline";
import { promisify } from "node:util";
import pg from "pg";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const options = ["--database", "--owner-email", "--owner-name", "--partner-email", "--partner-name"];

function usage() {
  return `Usage: node scripts/provision-space.mjs \\
  --database our_places \\
  --owner-email you@example.com --owner-name "Your name" \\
  --partner-email partner@example.com --partner-name "Partner name"

Set DATABASE_URL for the dedicated Our Places PostgreSQL database first.
Passwords are requested twice per member in an interactive terminal, never as arguments.`;
}

function parseArgs(args) {
  if (args.length !== options.length * 2) throw new Error(usage());
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!options.includes(option) || values.has(option) || !value || value.startsWith("--")) {
      throw new Error(usage());
    }
    values.set(option, value);
  }
  if (values.size !== options.length) throw new Error(usage());
  return Object.fromEntries(values);
}

function validateInvites(args) {
  const database = args["--database"];
  if (!/^[A-Za-z][A-Za-z0-9_]{2,62}$/.test(database)
    || /^(postgres|template0|template1)$/i.test(database)
    || /igst/i.test(database)) {
    throw new Error("Use a dedicated Our Places database name; system and IGST databases are refused.");
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const ownerEmail = args["--owner-email"].trim().toLowerCase();
  const partnerEmail = args["--partner-email"].trim().toLowerCase();
  const ownerName = args["--owner-name"].trim();
  const partnerName = args["--partner-name"].trim();
  if (![ownerEmail, partnerEmail].every((email) => emailPattern.test(email) && email.length <= 254)
    || ownerEmail === partnerEmail) {
    throw new Error("Provide two distinct, valid invited email addresses.");
  }
  if (![ownerName, partnerName].every((name) => name.length >= 1 && name.length <= 80)
    || ownerName.toLocaleLowerCase() === partnerName.toLocaleLowerCase()) {
    throw new Error("Provide two distinct display names of at most 80 characters.");
  }
  return { database, ownerEmail, ownerName, partnerEmail, partnerName };
}

function databaseFromUrl(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://.");
  }
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!database) throw new Error("DATABASE_URL must name a dedicated database.");
  return { database, host: parsed.hostname, port: parsed.port || "5432" };
}

async function askConfirmation(database) {
  const line = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await new Promise((resolve) => {
      line.question(`Type PROVISION ${database} to create the two accounts: `, resolve);
    })).trim();
  } finally {
    line.close();
  }
}

function readHidden(label) {
  return new Promise((resolve, reject) => {
    let password = "";
    const wasRaw = process.stdin.isRaw ?? false;
    process.stdout.write(`${label}: `);
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    function finish(error) {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    }

    function onKeypress(character, key) {
      if (key?.name === "return" || key?.name === "enter") return finish();
      if ((key?.ctrl && key?.name === "c") || key?.name === "escape") {
        return finish(new Error("Provisioning cancelled before any database writes."));
      }
      if (key?.name === "backspace") {
        password = Array.from(password).slice(0, -1).join("");
        return;
      }
      if (!key?.ctrl && !key?.meta && character && !/[\x00-\x1f\x7f]/.test(character)) {
        password += character;
      }
    }

    process.stdin.on("keypress", onKeypress);
  });
}

async function askPassword(label) {
  const password = await readHidden(`${label} password (12–256 characters)`);
  const confirmation = await readHidden(`Confirm ${label} password`);
  if (password !== confirmation) throw new Error(`${label} passwords did not match; no data was written.`);
  if (password.length < 12 || password.length > 256) {
    throw new Error(`${label} password must be between 12 and 256 characters; no data was written.`);
  }
  return password;
}

// Exactly matches src/lib/password.ts: scrypt-v1$base64url(16-byte salt)$base64url(64-byte key).
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt-v1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function assertEmpty(queryable) {
  const { rows } = await queryable.query(
    `select (select count(*)::integer from app_users) as users,
            (select count(*)::integer from spaces) as spaces`,
  );
  if (rows[0]?.users !== 0 || rows[0]?.spaces !== 0) {
    throw new Error("Target database already has Our Places users or spaces. No data was written.");
  }
}

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. No connection was made.");
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this script in an interactive TTY. Passwords are never read with echo enabled.");
  }
  const invite = validateInvites(parseArgs(process.argv.slice(2)));
  const target = databaseFromUrl(process.env.DATABASE_URL);
  if (target.database !== invite.database) {
    throw new Error("--database does not match the database named in DATABASE_URL. No connection was made.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const { rows } = await pool.query("select current_database() as database_name");
    if (rows[0]?.database_name !== invite.database) {
      throw new Error("Connected PostgreSQL database differs from --database. No data was written.");
    }
    await assertEmpty(pool);
    process.stdout.write(`\nTarget: PostgreSQL ${target.host}:${target.port} / ${invite.database}\n`);
    process.stdout.write(`Invited accounts: ${invite.ownerEmail} and ${invite.partnerEmail}\n`);
    process.stdout.write("This creates one private space and exactly two accounts.\n");
    if (await askConfirmation(invite.database) !== `PROVISION ${invite.database}`) {
      throw new Error("Confirmation did not match. No data was written.");
    }

    const ownerPassword = await askPassword("Owner");
    const partnerPassword = await askPassword("Partner");
    if (ownerPassword === partnerPassword) {
      throw new Error("Use different passwords for the two accounts. No data was written.");
    }
    const [ownerHash, partnerHash] = await Promise.all([
      hashPassword(ownerPassword), hashPassword(partnerPassword),
    ]);

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("lock table app_users, spaces, space_members in exclusive mode");
      await assertEmpty(client);
      const { rows: [space] } = await client.query(
        "insert into spaces (name) values ($1) returning id", ["Our Places"],
      );
      const { rows: [owner] } = await client.query(
        `insert into app_users (email, display_name, password_hash)
         values ($1, $2, $3) returning id`,
        [invite.ownerEmail, invite.ownerName, ownerHash],
      );
      const { rows: [partner] } = await client.query(
        `insert into app_users (email, display_name, password_hash)
         values ($1, $2, $3) returning id`,
        [invite.partnerEmail, invite.partnerName, partnerHash],
      );
      await client.query(
        `insert into space_members (space_id, user_id, role) values
         ($1, $2, 'owner'), ($1, $3, 'partner')`,
        [space.id, owner.id, partner.id],
      );
      await client.query("commit");
      process.stdout.write("Provisioning complete: one space and two invited accounts created.\n");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Provisioning stopped: ${message}\n`);
  process.exitCode = 1;
});
