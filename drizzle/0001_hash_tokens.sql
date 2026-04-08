-- Hash tokens: store invite token hash instead of plaintext,
-- remove download grant token column (now HMAC-derived from grant ID).
--
-- BREAKING: Existing unused invite tokens and download grants will be invalidated.
-- Tokens are short-lived (24-72h), so this is expected during a security migration.

-- Invite tokens: rename column to reflect that it now stores a hash
ALTER TABLE "rooms" RENAME COLUMN "invite_token" TO "invite_token_hash";
ALTER INDEX "rooms_invite_token_unique" RENAME TO "rooms_invite_token_hash_unique";

-- Download grants: remove plaintext token column (now derived via HMAC)
ALTER TABLE "download_grants" DROP CONSTRAINT "download_grants_token_unique";
ALTER TABLE "download_grants" DROP COLUMN "token";
