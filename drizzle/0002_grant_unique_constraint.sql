-- Prevent duplicate download grants for the same room+track+role combination.
-- Ensures idempotency: retried grant creation is safely ignored via ON CONFLICT DO NOTHING.

ALTER TABLE "download_grants"
  ADD CONSTRAINT "download_grants_room_track_role_unique"
  UNIQUE ("room_id", "track_id", "participant_role");
