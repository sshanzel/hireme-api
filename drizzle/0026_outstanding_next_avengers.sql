ALTER TABLE "story_raw" RENAME TO "story";--> statement-breakpoint
ALTER TABLE "story_raw_event" RENAME TO "story_event";--> statement-breakpoint
ALTER TABLE "story_event" RENAME COLUMN "story_raw_id" TO "story_id";--> statement-breakpoint
ALTER TABLE "story_index" DROP CONSTRAINT "story_index_story_id_story_raw_id_fk";
--> statement-breakpoint
ALTER TABLE "story" DROP CONSTRAINT "story_raw_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "story" DROP CONSTRAINT "story_raw_experience_id_experience_id_fk";
--> statement-breakpoint
ALTER TABLE "story_event" DROP CONSTRAINT "story_raw_event_story_raw_id_story_raw_id_fk";
--> statement-breakpoint
ALTER TABLE "story_index" ADD CONSTRAINT "story_index_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story" ADD CONSTRAINT "story_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_event" ADD CONSTRAINT "story_event_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story"("id") ON DELETE no action ON UPDATE no action;