import {and, eq} from 'drizzle-orm';
import {db} from '../db/index.ts';
import {FileStatus, fileTable} from '../db/schema/file.ts';
import {experienceTable, ExperienceType} from '../db/schema/experience.ts';
import type {SubscriptionConfig} from './types.ts';
import {getSignedUrl} from '../services/storage.ts';
import {parseResume, type Entry, type Entry2, type ExtractedData} from '../services/parser.ts';
import {userParsedArchive} from '../db/schema/userParsedArchive.ts';
import {userTable} from '../db/schema/user.ts';
import {sanitizeBullets} from '../utils/sanitize.ts';

interface CvUploadedEvent {
  fileId: string;
}

export function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

const formatDescription = (desc: string) => {
  const sanitized = sanitizeBullets(desc);
  const result = sanitized
    .split('•')
    .filter(Boolean)
    .map(str => `• ${str.trim()}`)
    .join('\n\n');
  console.log('Sanitized Description:', result);

  return result;
};

export function mapWorkExperience(userId: string, exp: Entry2) {
  return {
    userId,
    type: ExperienceType.Work,
    title: exp.title,
    organization: exp.company || null,
    startDate: parseDate(exp.start_date) || new Date(),
    endDate: parseDate(exp.end_date),
    description: exp.description ? formatDescription(exp.description) : null,
    skills: null,
  };
}

export function mapEducation(userId: string, edu: Entry) {
  return {
    userId,
    type: ExperienceType.Education,
    title: edu.title,
    organization: edu.establishment || null,
    startDate: parseDate(edu.start_date) || new Date(),
    endDate: parseDate(edu.end_date),
    description: edu.description ? formatDescription(edu.description) : null,
    skills: null,
  };
}

interface MappedUserInfo {
  links: string[];
  name: string | undefined;
  summary: string | null;
  headline: string | null;
}

export function mapUserInfo(extractedData: ExtractedData): MappedUserInfo {
  const personalInfos = extractedData.personal_infos;
  return {
    links: personalInfos.urls || [],
    name: personalInfos.name?.raw_name || undefined,
    summary: personalInfos.self_summary ? sanitizeBullets(personalInfos.self_summary) : null,
    headline: personalInfos.current_profession || null,
  };
}

export const cvUploadParsingSubscription: SubscriptionConfig<CvUploadedEvent> = {
  topic: 'api.v1.cv-uploaded',
  subscription: 'api.v1.cv-uploaded-parsing',
  handler: async (data): Promise<void> => {
    console.log(`processing file id: ${data.fileId}`);
    const [file] = await db
      .select()
      .from(fileTable)
      .where(and(eq(fileTable.id, data.fileId), eq(fileTable.status, FileStatus.Uploaded)))
      .limit(1);

    if (!file) {
      return; // log here in the future
    }

    let signedUrl = file.signedUrl;

    if (!file.signedUrl) {
      const [url, signedUrlExpiry] = await getSignedUrl(file.gcsPath, 15 * 60); // URL valid for 15 minutes
      signedUrl = url;
      await db
        .update(fileTable)
        .set({signedUrl, signedUrlExpiry: new Date(signedUrlExpiry)})
        .where(eq(fileTable.id, data.fileId));
    }

    await db
      .update(fileTable)
      .set({status: FileStatus.Processing, updatedAt: new Date()})
      .where(eq(fileTable.id, data.fileId));

    const parsedData = await parseResume(signedUrl!);
    const stringified = JSON.stringify(parsedData);

    // Archive the raw parsed data
    await db
      .insert(userParsedArchive)
      .values({userId: file.userId, stringified, updatedAt: new Date()})
      .onConflictDoUpdate({
        target: [userParsedArchive.userId],
        set: {stringified, updatedAt: new Date()},
      });

    // Clear existing experiences for this user before inserting new ones
    await db.delete(experienceTable).where(eq(experienceTable.userId, file.userId));

    const extractedData = parsedData.output.extracted_data;

    // Map and insert work experiences
    const workExperiences = extractedData.work_experience.entries.map(exp =>
      mapWorkExperience(file.userId, exp)
    );
    if (workExperiences.length > 0) {
      await db.insert(experienceTable).values(workExperiences);
      console.log(`Inserted ${workExperiences.length} work experiences`);
    }

    // Map and insert education
    const educationRecords = extractedData.education.entries.map(edu =>
      mapEducation(file.userId, edu)
    );
    if (educationRecords.length > 0) {
      await db.insert(experienceTable).values(educationRecords);
      console.log(`Inserted ${educationRecords.length} education records`);
    }

    const userInfo = mapUserInfo(extractedData);
    await db.update(userTable).set(userInfo).where(eq(userTable.id, file.userId));

    await db
      .update(fileTable)
      .set({status: FileStatus.Processed, updatedAt: new Date()})
      .where(eq(fileTable.id, data.fileId));

    console.log(`CV parsing complete for file id: ${data.fileId}`);
  },
};
