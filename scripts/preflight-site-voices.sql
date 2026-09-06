-- Operator-only, read-only inventory. Run against the intended direct database
-- before approving the additive migration; this script never changes data.
BEGIN READ ONLY;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';

SELECT current_database() AS database, current_schema() AS schema;
SELECT migration_name, finished_at IS NOT NULL AS finished,
  rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count
FROM "_prisma_migrations" ORDER BY started_at;

SELECT table_name, column_name, data_type, datetime_precision, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = current_schema() AND table_name IN ('User', 'SiteVisitor', 'SiteVisitEvent')
ORDER BY table_name, ordinal_position;

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = current_schema() AND tablename IN ('User', 'SiteVisitor', 'SiteVisitEvent')
ORDER BY tablename, indexname;

SELECT conrelid::regclass AS table_name, conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid IN ('"User"'::regclass, '"SiteVisitor"'::regclass)
ORDER BY conrelid::regclass::text, conname;

-- Only aggregates; historical isAuthenticated is not proof of any User.id.
SELECT COUNT(*) AS browser_rows,
  COUNT(*) FILTER (WHERE "isAuthenticated" IS TRUE) AS last_observed_authenticated,
  COUNT(*) FILTER (WHERE "isAuthenticated" IS FALSE) AS last_observed_guest,
  COUNT(*) FILTER (WHERE "isAuthenticated" IS NULL) AS unknown_legacy_state
FROM "SiteVisitor";
SELECT COUNT(*) AS preserved_visit_events FROM "SiteVisitEvent";
COMMIT;
