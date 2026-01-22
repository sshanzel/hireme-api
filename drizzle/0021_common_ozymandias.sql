ALTER TABLE "story_raw_event" RENAME COLUMN "type" TO "role";--> statement-breakpoint
ALTER TABLE "story_raw" ALTER COLUMN "tags" SET DEFAULT '{}';