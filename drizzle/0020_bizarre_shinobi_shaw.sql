ALTER TABLE "story_index"
DROP CONSTRAINT "story_index_story_id_story_id_fk";
--> statement-breakpoint
ALTER TABLE "story" DROP CONSTRAINT "story_pkey";
--> statement-breakpoint
ALTER TABLE "story" ADD PRIMARY KEY ("story_raw_id");
--> statement-breakpoint
/* 
Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
We are working on making it available!

Meanwhile you can:
1. Check pk name in your database, by running
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND table_name = 'story_index'
AND constraint_type = 'PRIMARY KEY';
2. Uncomment code below and paste pk name manually

Hope to release this update as soon as possible
*/

ALTER TABLE "story_index" DROP CONSTRAINT "story_index_pkey";
--> statement-breakpoint
ALTER TABLE "story_index" ALTER COLUMN "story_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "story" ADD COLUMN "content" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "story_index"
ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL;
--> statement-breakpoint
ALTER TABLE "story_raw"
ADD COLUMN "tags" text [] DEFAULT '{}'::text [];
--> statement-breakpoint
ALTER TABLE "story_index"
ADD CONSTRAINT "story_index_story_id_story_story_raw_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."story" ("story_raw_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "story" DROP COLUMN "id";