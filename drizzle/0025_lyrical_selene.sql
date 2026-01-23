ALTER TABLE "story_index"
DROP CONSTRAINT "story_index_story_id_story_story_raw_id_fk";
--> statement-breakpoint
ALTER TABLE "story" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP TABLE "story" CASCADE;
--> statement-breakpoint
ALTER TABLE "story_index"
ADD CONSTRAINT "story_index_story_id_story_raw_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story_raw" ("id") ON DELETE no action ON UPDATE no action;