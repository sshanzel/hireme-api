-- Table is empty, so we can drop and recreate the column
ALTER TABLE "file" DROP COLUMN "size_in_bytes";
ALTER TABLE "file" ADD COLUMN "size_in_bytes" integer NOT NULL;
