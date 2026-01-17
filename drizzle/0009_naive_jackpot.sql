CREATE TYPE "public"."story_raw_event_type" AS ENUM('system', 'user');--> statement-breakpoint
ALTER TABLE "story_raw_event" ADD COLUMN "type" "story_raw_event_type" NOT NULL;