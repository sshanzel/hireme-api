ALTER TABLE "user" RENAME COLUMN "displayName" TO "display_name";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "sourceType" TO "source_type";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "originalFileName" TO "original_file_name";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "mimeType" TO "mime_type";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "gcsBucket" TO "gcs_bucket";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "gcsPath" TO "gcs_path";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "sizeInBytes" TO "size_in_bytes";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "contentSha256" TO "content_sha256";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "updatedAt" TO "updated_at";