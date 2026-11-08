/**
 * The `account.issuer` backfill has to be total. The column lands NOT NULL, so
 * a row the UPDATE misses aborts the whole migration and leaves an upgraded
 * install with no working auth at all. This suite rewinds the migration,
 * seeds the pre-upgrade rows an existing deployment would have, and re-applies
 * it — a backfill narrowed to one provider fails here.
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { getTableConfig } from "drizzle-orm/pg-core";
import postgres from "postgres";
import { afterEach, describe, expect, it } from "vitest";
import { applyPendingMigrations } from "./client.js";
import { authAccounts } from "./schema/auth.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./test-embedded-postgres.js";

const MIGRATION_FILE = "0230_better_auth_account_issuer.sql";
const UNIQUE_INDEX = "account_issuer_account_id_uq";

// Better Auth's own issuer helpers: `createLocalAccountIssuer("credential")`
// for email/password and `createOAuthAccountIssuer(providerId)` for a social
// provider that declares no issuer of its own. Sign-in looks the credential
// account up by this exact value.
const CREDENTIAL_ISSUER = "local:credential";
const OAUTH_ISSUER_PREFIX = "local:oauth:";

const cleanups: Array<() => Promise<void>> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

async function migrationHash() {
  const content = await fs.promises.readFile(
    new URL(`./migrations/${MIGRATION_FILE}`, import.meta.url),
    "utf8",
  );
  return createHash("sha256").update(content).digest("hex");
}

describe("account issuer schema", () => {
  it("keeps issuer as a nullable legacy column with no (issuer, account_id) key", () => {
    // Better Auth 1.7.3+ keys accounts on (providerId, accountId) and no longer
    // writes issuer (migration 0377, Better Auth 1.7 upgrade guide).
    const config = getTableConfig(authAccounts);
    const issuer = config.columns.find((column) => column.name === "issuer");
    expect(issuer).toBeDefined();
    expect(issuer?.notNull).toBe(false);
    expect(config.indexes.find((index) => index.config.name === UNIQUE_INDEX)).toBeUndefined();
  });
});

describeEmbeddedPostgres("account issuer migration", () => {
  // Reverse registration order, one at a time. The raw `postgres` client is not
  // registered with the module's client registry, so the cluster teardown does
  // not close it. Stopping the cluster while that client is still draining kills
  // the backend socket under a queued write and can crash the runner.
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      await cleanup();
    }
  });

  it("backfills every pre-upgrade row before the column goes NOT NULL", async () => {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-account-issuer-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1 });
    cleanups.push(async () => sql.end());

    // Rewind to the pre-upgrade shape: no issuer column, no unique index.
    await sql`DELETE FROM "drizzle"."__drizzle_migrations" WHERE "hash" = ${await migrationHash()}`;
    await sql`DROP INDEX IF EXISTS ${sql(UNIQUE_INDEX)}`;
    await sql`ALTER TABLE "account" DROP COLUMN IF EXISTS "issuer"`;

    const credentialUserId = `user-${randomUUID()}`;
    const socialUserId = `user-${randomUUID()}`;
    const credentialAccountId = `account-${randomUUID()}`;
    const githubAccountId = `account-${randomUUID()}`;
    const googleAccountId = `account-${randomUUID()}`;

    await sql`
      INSERT INTO "user" ("id", "name", "email", "created_at", "updated_at")
      VALUES
        (${credentialUserId}, 'Credential User', 'credential@example.com', now(), now()),
        (${socialUserId}, 'Social User', 'social@example.com', now(), now())
    `;
    await sql`
      INSERT INTO "account"
        ("id", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
      VALUES
        (${credentialAccountId}, ${credentialUserId}, 'credential', ${credentialUserId}, 'hashed', now(), now()),
        (${githubAccountId}, 'github-subject-1', 'github', ${socialUserId}, NULL, now(), now()),
        (${googleAccountId}, 'google-subject-1', 'google', ${socialUserId}, NULL, now(), now())
    `;

    await applyPendingMigrations(database.connectionString);

    const rows = await sql<{ id: string; issuer: string }[]>`
      SELECT "id", "issuer" FROM "account" ORDER BY "id"
    `;
    const issuerById = new Map(rows.map((row) => [row.id, row.issuer]));
    expect(issuerById.get(credentialAccountId)).toBe(CREDENTIAL_ISSUER);
    // A backfill restricted to `provider_id = 'credential'` leaves these NULL,
    // and SET NOT NULL then aborts the upgrade.
    expect(issuerById.get(githubAccountId)).toBe(`${OAUTH_ISSUER_PREFIX}github`);
    expect(issuerById.get(googleAccountId)).toBe(`${OAUTH_ISSUER_PREFIX}google`);

    const [issuerColumn] = await sql<{ is_nullable: string }[]>`
      SELECT "is_nullable" FROM "information_schema"."columns"
      WHERE "table_name" = 'account' AND "column_name" = 'issuer'
    `;
    expect(issuerColumn?.is_nullable).toBe("NO");

    const indexes = await sql<{ indexname: string }[]>`
      SELECT "indexname" FROM "pg_indexes"
      WHERE "tablename" = 'account' AND "indexname" = ${UNIQUE_INDEX}
    `;
    expect(indexes).toHaveLength(1);

    // The restored index rejects a second account under the same key.
    await expect(
      sql`
        INSERT INTO "account"
          ("id", "issuer", "account_id", "provider_id", "user_id", "created_at", "updated_at")
        VALUES (${`account-${randomUUID()}`}, ${CREDENTIAL_ISSUER}, ${credentialUserId}, 'credential', ${credentialUserId}, now(), now())
      `,
    ).rejects.toMatchObject({ code: "23505", constraint_name: UNIQUE_INDEX });
  }, 30_000);
});

const RELAX_MIGRATION_FILE = "0377_relax_better_auth_account_issuer.sql";

async function relaxMigrationHash() {
  const content = await fs.promises.readFile(
    new URL(`./migrations/${RELAX_MIGRATION_FILE}`, import.meta.url),
    "utf8",
  );
  return createHash("sha256").update(content).digest("hex");
}

describeEmbeddedPostgres("account issuer relaxation (0377)", () => {
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      await cleanup();
    }
  });

  async function rewindTo172Shape() {
    const database = await startEmbeddedPostgresTestDatabase("paperclip-account-issuer-relax-");
    cleanups.push(database.cleanup);
    const sql = postgres(database.connectionString, { max: 1 });
    cleanups.push(async () => sql.end());
    // Rewind 0377: issuer NOT NULL again (empty table) and the 1.7.2 unique key.
    await sql`DELETE FROM "drizzle"."__drizzle_migrations" WHERE "hash" = ${await relaxMigrationHash()}`;
    await sql`ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sql(UNIQUE_INDEX)} ON "account" ("issuer", "account_id")`;
    const userId = `user-${randomUUID()}`;
    await sql`INSERT INTO "user" ("id", "name", "email", "created_at", "updated_at")
      VALUES (${userId}, 'Legacy User', ${`${userId}@example.com`}, now(), now())`;
    return { database, sql, userId };
  }

  it("preserves legacy issuer values and accepts rows written without one", async () => {
    const { database, sql, userId } = await rewindTo172Shape();
    const legacyId = `account-${randomUUID()}`;
    await sql`INSERT INTO "account" ("id", "issuer", "account_id", "provider_id", "user_id", "password", "created_at", "updated_at")
      VALUES (${legacyId}, ${CREDENTIAL_ISSUER}, ${userId}, 'credential', ${userId}, 'hashed', now(), now())`;

    await applyPendingMigrations(database.connectionString);

    const [legacy] = await sql<{ issuer: string | null }[]>`SELECT "issuer" FROM "account" WHERE "id" = ${legacyId}`;
    expect(legacy?.issuer).toBe(CREDENTIAL_ISSUER);
    const [issuerColumn] = await sql<{ is_nullable: string }[]>`
      SELECT "is_nullable" FROM "information_schema"."columns"
      WHERE "table_name" = 'account' AND "column_name" = 'issuer'`;
    expect(issuerColumn?.is_nullable).toBe("YES");
    expect(await sql`SELECT 1 FROM "pg_indexes" WHERE "tablename" = 'account' AND "indexname" = ${UNIQUE_INDEX}`).toHaveLength(0);
    // Better Auth 1.7.3+ inserts accounts without an issuer.
    await sql`INSERT INTO "account" ("id", "account_id", "provider_id", "user_id", "created_at", "updated_at")
      VALUES (${`account-${randomUUID()}`}, 'github-subject-1', 'github', ${userId}, now(), now())`;
  }, 60_000);

  it("refuses to migrate over duplicate (provider_id, account_id) rows", async () => {
    const { database, sql, userId } = await rewindTo172Shape();
    // Distinct issuers made these rows legal under the 1.7.2 key, but Better
    // Auth 1.7.3+ rejects lookups that match more than one row.
    await sql`INSERT INTO "account" ("id", "issuer", "account_id", "provider_id", "user_id", "created_at", "updated_at")
      VALUES
        (${`account-${randomUUID()}`}, 'issuer-a', 'shared-subject', 'oidc', ${userId}, now(), now()),
        (${`account-${randomUUID()}`}, 'issuer-b', 'shared-subject', 'oidc', ${userId}, now(), now())`;

    await expect(applyPendingMigrations(database.connectionString)).rejects.toThrow(/duplicate \(provider_id, account_id\)/);
    const [issuerColumn] = await sql<{ is_nullable: string }[]>`
      SELECT "is_nullable" FROM "information_schema"."columns"
      WHERE "table_name" = 'account' AND "column_name" = 'issuer'`;
    expect(issuerColumn?.is_nullable).toBe("NO");
  }, 60_000);
});
