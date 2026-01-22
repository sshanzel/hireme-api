#!/usr/bin/env npx tsx
/**
 * Remap user_parsed_archive to verify and apply mapping logic
 * Usage: npx tsx bin/remap-archive.ts <userId> [--apply]
 *
 * Without --apply: Preview the remapped data (dry run)
 * With --apply: Actually update the database with remapped data
 */
import 'dotenv/config';
import {eq} from 'drizzle-orm';
import {db} from '../src/db/index.ts';
import {userParsedArchive} from '../src/db/schema/userParsedArchive.ts';
import {experienceTable} from '../src/db/schema/experience.ts';
import {userTable} from '../src/db/schema/user.ts';
import {
  mapWorkExperience,
  mapEducation,
  mapUserInfo,
} from '../src/subscriptions/cvUploadParsing.ts';
import type {ResumeData} from '../src/services/parser.ts';

function printSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

function printSubSection(title: string) {
  console.log('\n' + '-'.repeat(40));
  console.log(title);
  console.log('-'.repeat(40));
}

async function main() {
  const args = process.argv.slice(2);
  const applyFlag = args.includes('--apply');
  const userId = args.find(arg => !arg.startsWith('--'));

  if (!userId) {
    console.error('Usage: npx tsx bin/remap-archive.ts <userId> [--apply]');
    console.error('  --apply    Apply changes to database (without this flag, it\'s a dry run)');
    process.exit(1);
  }

  console.log(applyFlag ? '🔧 APPLY MODE: Changes will be saved to database\n' : '👀 DRY RUN: No changes will be made\n');

  const [archive] = await db
    .select()
    .from(userParsedArchive)
    .where(eq(userParsedArchive.userId, userId));

  if (!archive) {
    console.error(`No archive found for user: ${userId}`);
    process.exit(1);
  }

  printSection(`USER: ${archive.userId}`);
  console.log(`Archive updated: ${archive.updatedAt}`);

  let parsedData: ResumeData;
  try {
    parsedData = JSON.parse(archive.stringified);
  } catch (err) {
    console.error('Failed to parse archive JSON:', err);
    process.exit(1);
  }

  const extractedData = parsedData.output?.extracted_data;
  if (!extractedData) {
    console.error('No extracted_data found in archive');
    process.exit(1);
  }

  // Map user info
  printSubSection('MAPPED: User Info');
  const mappedUser = mapUserInfo(extractedData);
  console.log(JSON.stringify(mappedUser, null, 2));

  // Map work experiences
  printSubSection('MAPPED: Work Experiences');
  const workEntries = extractedData.work_experience?.entries || [];
  const mappedWork = workEntries.map(exp => mapWorkExperience(archive.userId, exp));
  mappedWork.forEach((exp, i) => {
    console.log(`\n[${i + 1}] ${exp.title}`);
    console.log(`    Organization: ${exp.organization || 'N/A'}`);
    const startDate = exp.startDate instanceof Date ? exp.startDate.toISOString().split('T')[0] : 'N/A';
    const endDate = exp.endDate instanceof Date ? exp.endDate.toISOString().split('T')[0] : 'Present';
    console.log(`    Period: ${startDate} - ${endDate}`);
    console.log(`    Description: ${exp.description?.substring(0, 150) || 'N/A'}...`);
  });

  // Map education
  printSubSection('MAPPED: Education');
  const eduEntries = extractedData.education?.entries || [];
  const mappedEdu = eduEntries.map(edu => mapEducation(archive.userId, edu));
  mappedEdu.forEach((edu, i) => {
    console.log(`\n[${i + 1}] ${edu.title}`);
    console.log(`    Organization: ${edu.organization || 'N/A'}`);
    const startDate = edu.startDate instanceof Date ? edu.startDate.toISOString().split('T')[0] : 'N/A';
    const endDate = edu.endDate instanceof Date ? edu.endDate.toISOString().split('T')[0] : 'N/A';
    console.log(`    Period: ${startDate} - ${endDate}`);
    console.log(`    Description: ${edu.description || 'N/A'}`);
  });

  // Summary
  printSubSection('SUMMARY');
  console.log(`Work experiences: ${mappedWork.length}`);
  console.log(`Education: ${mappedEdu.length}`);

  if (applyFlag) {
    printSubSection('APPLYING CHANGES');

    // Clear existing experiences
    await db.delete(experienceTable).where(eq(experienceTable.userId, archive.userId));
    console.log('Cleared existing experiences');

    // Insert work experiences
    if (mappedWork.length > 0) {
      await db.insert(experienceTable).values(mappedWork);
      console.log(`Inserted ${mappedWork.length} work experiences`);
    }

    // Insert education
    if (mappedEdu.length > 0) {
      await db.insert(experienceTable).values(mappedEdu);
      console.log(`Inserted ${mappedEdu.length} education records`);
    }

    // Update user info
    await db.update(userTable).set(mappedUser).where(eq(userTable.id, archive.userId));
    console.log('Updated user info');

    console.log('\n✅ Changes applied successfully!');
  } else {
    printSubSection('DRY RUN COMPLETE');
    console.log('Run with --apply to save changes to database');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
