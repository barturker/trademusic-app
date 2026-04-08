-- PostgreSQL tuning for 4GB VPS
-- Most settings are passed via docker-compose command args.
-- This file handles anything that needs SQL-level init.

-- Enable pg_trgm for future text search if needed
CREATE EXTENSION IF NOT EXISTS pg_trgm;
