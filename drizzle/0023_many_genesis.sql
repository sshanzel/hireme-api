ALTER TABLE "story_index" DROP COLUMN "metadata";

ALTER TABLE "story_index" ADD COLUMN "metadata" jsonb;