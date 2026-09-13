-- Additive only: existing rows have no precise location until a visitor
-- opts in via the browser's geolocation permission prompt on a future visit.
ALTER TABLE "SiteVisitor" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "SiteVisitor" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "SiteVisitor" ADD COLUMN "locationAccuracyM" INTEGER;
ALTER TABLE "StoryView" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "StoryView" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "StoryView" ADD COLUMN "locationAccuracyM" INTEGER;
