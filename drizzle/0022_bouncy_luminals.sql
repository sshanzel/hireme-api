CREATE EXTENSION vector;

ALTER TABLE story_index DROP COLUMN vector;

ALTER TABLE "story_index" ADD COLUMN vector vector (1536);