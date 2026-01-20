CREATE TABLE "user_parsed_archive" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"parsed" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_parsed_archive" ADD CONSTRAINT "user_parsed_archive_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;