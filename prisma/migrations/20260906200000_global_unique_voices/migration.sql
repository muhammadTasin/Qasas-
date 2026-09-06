-- Additive only: preserve all browser streams, events and application data.
-- Fail atomically on incompatible drift; never guess/backfill old identities.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE "SiteVisitor" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "siteLastSeenAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name = 'SiteVisitor' AND column_name = 'userId'
      AND data_type = 'text' AND is_nullable = 'YES' AND column_default IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name = 'User' AND column_name = 'siteLastSeenAt'
      AND data_type = 'timestamp without time zone' AND datetime_precision = 3
      AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN RAISE EXCEPTION 'Incompatible global visitor column drift; review schema before retrying'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"SiteVisitor"'::regclass AND conname = 'SiteVisitor_userId_fkey') THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint WHERE conrelid = '"SiteVisitor"'::regclass AND contype = 'f'
        AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = '"SiteVisitor"'::regclass AND attname = 'userId')]
    ) THEN RAISE EXCEPTION 'Unexpected userId foreign key name; reconcile before retrying'; END IF;
    ALTER TABLE "SiteVisitor" ADD CONSTRAINT "SiteVisitor_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = '"SiteVisitor"'::regclass
      AND conname = 'SiteVisitor_userId_fkey' AND contype = 'f'
      AND confrelid = '"User"'::regclass AND confdeltype = 'n' AND confupdtype = 'c'
      AND convalidated AND NOT condeferrable
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = '"SiteVisitor"'::regclass AND attname = 'userId')]
      AND confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = '"User"'::regclass AND attname = 'id')]
  ) THEN RAISE EXCEPTION 'Incompatible SiteVisitor_userId_fkey drift'; END IF;
END $$;

-- Check both definitions and names before creating indexes. An equivalent
-- differently named index requires operator reconciliation, not duplication.
DO $$
DECLARE spec RECORD; existing RECORD;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('User', 'User_siteLastSeenAt_idx', ARRAY['siteLastSeenAt']::text[]),
    ('SiteVisitor', 'SiteVisitor_userId_lastSeenAt_idx', ARRAY['userId', 'lastSeenAt']::text[])
  ) AS specs(table_name, index_name, columns) LOOP
    FOR existing IN
      SELECT c.relname, i.indisvalid, i.indisunique, i.indpred, i.indexprs, am.amname,
        ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(attnum, n)
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum ORDER BY k.n) AS columns
      FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_am am ON am.oid = c.relam
      WHERE i.indrelid = format('%I', spec.table_name)::regclass
    LOOP
      IF existing.relname = spec.index_name AND
        (existing.columns <> spec.columns OR NOT existing.indisvalid OR existing.indisunique
          OR existing.indpred IS NOT NULL OR existing.indexprs IS NOT NULL OR existing.amname <> 'btree')
      THEN RAISE EXCEPTION 'Incompatible index drift: %', spec.index_name; END IF;
      IF existing.relname <> spec.index_name AND existing.columns = spec.columns AND existing.indpred IS NULL
      THEN RAISE EXCEPTION 'Equivalent index % already exists; reconcile name to % before retrying', existing.relname, spec.index_name; END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS "User_siteLastSeenAt_idx" ON "User"("siteLastSeenAt");
CREATE INDEX IF NOT EXISTS "SiteVisitor_userId_lastSeenAt_idx" ON "SiteVisitor"("userId", "lastSeenAt");
COMMIT;
