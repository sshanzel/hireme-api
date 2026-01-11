CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"sourceType" text NOT NULL,
	"originalFileName" text NOT NULL,
	"mimeType" text NOT NULL,
	"gcsBucket" text NOT NULL,
	"gcsPath" text NOT NULL,
	"sizeInBytes" uuid NOT NULL,
	"contentSha256" text NOT NULL,
	"status" text NOT NULL,
	"tags" text[] NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
