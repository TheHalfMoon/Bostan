-- Better Auth 1.7.0-1.7.2 required "issuer" on `account` (migration 0230).
-- Better Auth 1.7.3+ no longer writes it and keys accounts on
-- ("provider_id", "account_id") again, so a NOT NULL "issuer" rejects every
-- sign-up and account link. Per the official 1.7 upgrade guide: drop the
-- (issuer, account_id) unique index first, then relax the column. Existing
-- issuer values are preserved; dropping the column is optional later cleanup.
--
-- Better Auth rejects account lookups when more than one row matches the
-- (provider_id, account_id) key, so refuse to migrate over duplicates instead
-- of leaving an auth table that fails at sign-in.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "account" GROUP BY "provider_id", "account_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'account has duplicate (provider_id, account_id) rows; resolve them before upgrading Better Auth (see the Better Auth 1.7 upgrade guide)';
  END IF;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "account_issuer_account_id_uq";--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;
