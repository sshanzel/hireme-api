#!/usr/bin/env npx tsx
/**
 * Manually run CV parsing for a specific file
 * Usage: npx tsx bin/parse-cv.ts <fileId>
 */
import 'dotenv/config';
import {eq} from 'drizzle-orm';
import {db} from '../src/db/index.ts';
import {fileTable} from '../src/db/schema/file.ts';
import {experienceTable, ExperienceType} from '../src/db/schema/experience.ts';
import {getSignedUrl} from '../src/services/storage.ts';
import {parseResume, type Entry, type Entry2} from '../src/services/parser.ts';
import {userParsedArchive} from '../src/db/schema/userParsedArchive.ts';

function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function mapWorkExperience(userId: string, exp: Entry2) {
  return {
    userId,
    type: ExperienceType.Work,
    title: exp.title,
    organization: exp.company || null,
    startDate: parseDate(exp.start_date) || new Date(),
    endDate: parseDate(exp.end_date),
    description: exp.description || null,
    skills: null,
  };
}

function mapEducation(userId: string, edu: Entry) {
  return {
    userId,
    type: ExperienceType.Education,
    title: edu.title,
    organization: null,
    startDate: parseDate(edu.start_date) || new Date(),
    endDate: parseDate(edu.end_date),
    description: edu.description || null,
    skills: null,
  };
}

async function main() {
  const fileId = process.argv[2];

  if (!fileId) {
    console.error('Usage: npx tsx bin/parse-cv.ts <fileId>');
    process.exit(1);
  }

  console.log(`Processing file id: ${fileId}`);

  const [file] = await db.select().from(fileTable).where(eq(fileTable.id, fileId)).limit(1);

  if (!file) {
    console.error(`File not found: ${fileId}`);
    process.exit(1);
  }

  console.log(`Found file: ${file.originalFileName} for user ${file.userId}`);

  let signedUrl = file.signedUrl;

  if (!file.signedUrl) {
    console.log('Generating signed URL...');
    const [url, signedUrlExpiry] = await getSignedUrl(file.gcsPath, 15 * 60);
    signedUrl = url;
    await db
      .update(fileTable)
      .set({signedUrl, signedUrlExpiry: new Date(signedUrlExpiry)})
      .where(eq(fileTable.id, fileId));
  }

  console.log('Parsing resume...');
  const parsedData = await parseResume(signedUrl!);
  const stringified = JSON.stringify(parsedData);

  console.log('Archiving parsed data...');
  await db
    .insert(userParsedArchive)
    .values({userId: file.userId, stringified, updatedAt: new Date()})
    .onConflictDoUpdate({
      target: [userParsedArchive.userId],
      set: {stringified, updatedAt: new Date()},
    });

  console.log('Clearing existing experiences...');
  await db.delete(experienceTable).where(eq(experienceTable.userId, file.userId));

  const extractedData = parsedData.output.extracted_data;

  const workExperiences = extractedData.work_experience.entries.map(exp =>
    mapWorkExperience(file.userId, exp)
  );
  if (workExperiences.length > 0) {
    await db.insert(experienceTable).values(workExperiences);
    console.log(`Inserted ${workExperiences.length} work experiences`);
  }

  const educationRecords = extractedData.education.entries.map(edu =>
    mapEducation(file.userId, edu)
  );
  if (educationRecords.length > 0) {
    await db.insert(experienceTable).values(educationRecords);
    console.log(`Inserted ${educationRecords.length} education records`);
  }

  console.log('CV parsing complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
