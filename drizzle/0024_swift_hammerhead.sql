ALTER TABLE "story_raw" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "story_raw" ADD COLUMN "canonicalized_version" integer DEFAULT 0 NOT NULL;