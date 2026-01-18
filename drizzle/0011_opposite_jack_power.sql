ALTER TABLE "story_raw_event" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."story_raw_event_type";--> statement-breakpoint
CREATE TYPE "public"."story_raw_event_type" AS ENUM('assistant', 'user');--> statement-breakpoint
ALTER TABLE "story_raw_event" ALTER COLUMN "type" SET DATA TYPE "public"."story_raw_event_type" USING "type"::"public"."story_raw_event_type";