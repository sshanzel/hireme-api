#!/usr/bin/env npx tsx
/**
 * Remap user_parsed_archive to verify mapping logic
 * Usage: npx tsx bin/remap-archive.ts [userId]
 *
 * If userId is provided, only that user's archive is processed.
 * Otherwise, all archives are processed.
 */
import 'dotenv/config';
import {eq} from 'drizzle-orm';
import {db} from '../src/db/index.ts';
import {userParsedArchive} from '../src/db/schema/userParsedArchive.ts';
import {
  parseDate,
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
  const userId = process.argv[2];

  let archives;
  if (userId) {
    archives = await db.select().from(userParsedArchive).where(eq(userParsedArchive.userId, userId));
    if (archives.length === 0) {
      console.error(`No archive found for user: ${userId}`);
      process.exit(1);
    }
  } else {
    archives = await db.select().from(userParsedArchive);
    if (archives.length === 0) {
      console.error('No archives found in database');
      process.exit(1);
    }
  }

  console.log(`Found ${archives.length} archive(s) to process\n`);

  for (const archive of archives) {
    printSection(`USER: ${archive.userId}`);
    console.log(`Archive updated: ${archive.updatedAt}`);

    let parsedData: ResumeData;
    try {
      parsedData = JSON.parse(archive.stringified);
    } catch (err) {
      console.error('Failed to parse archive JSON:', err);
      continue;
    }

    const extractedData = parsedData.output?.extracted_data;
    if (!extractedData) {
      console.error('No extracted_data found in archive');
      continue;
    }

    // Personal Info
    printSubSection('RAW: Personal Info');
    const personalInfos = extractedData.personal_infos;
    console.log('Name:', JSON.stringify(personalInfos.name, null, 2));
    console.log('Phones:', personalInfos.phones);
    console.log('Emails:', personalInfos.mails);
    console.log('URLs:', personalInfos.urls);
    console.log('Self Summary:', personalInfos.self_summary?.substring(0, 200) + '...');
    console.log('Current Profession:', personalInfos.current_profession);
    console.log('Address:', JSON.stringify(personalInfos.address, null, 2));

    printSubSection('MAPPED: User Info (using mapUserInfo)');
    const mappedUser = mapUserInfo(extractedData);
    console.log(JSON.stringify(mappedUser, null, 2));

    // Work Experience
    printSubSection('RAW: Work Experience');
    const workEntries = extractedData.work_experience?.entries || [];
    console.log(`Total entries: ${workEntries.length}`);
    console.log(`Total years: ${extractedData.work_experience?.total_years_experience}`);
    workEntries.forEach((exp, i) => {
      console.log(`\n[${i + 1}] ${exp.title} at ${exp.company || 'N/A'}`);
      console.log(`    Period: ${exp.start_date || 'N/A'} - ${exp.end_date || 'Present'}`);
      console.log(`    Type: ${exp.type}`);
      console.log(`    Location: ${exp.location?.formatted_location || 'N/A'}`);
      console.log(`    Description: ${exp.description?.substring(0, 150) || 'N/A'}...`);
    });

    printSubSection('MAPPED: Work Experiences (using mapWorkExperience)');
    const mappedWork = workEntries.map(exp => mapWorkExperience(archive.userId, exp));
    mappedWork.forEach((exp, i) => {
      console.log(`\n[${i + 1}] ${exp.title}`);
      console.log(`    Organization: ${exp.organization || 'N/A'}`);
      const startDate = exp.startDate instanceof Date ? exp.startDate.toISOString().split('T')[0] : 'N/A';
      const endDate = exp.endDate instanceof Date ? exp.endDate.toISOString().split('T')[0] : 'Present';
      console.log(`    Period: ${startDate} - ${endDate}`);
      console.log(`    Description: ${exp.description?.substring(0, 100) || 'N/A'}...`);
    });

    // Education
    printSubSection('RAW: Education');
    const eduEntries = extractedData.education?.entries || [];
    console.log(`Total entries: ${eduEntries.length}`);
    eduEntries.forEach((edu, i) => {
      console.log(`\n[${i + 1}] ${edu.title}`);
      console.log(`    Establishment: ${edu.establishment || 'N/A'}`);
      console.log(`    Period: ${edu.start_date || 'N/A'} - ${edu.end_date || 'N/A'}`);
      console.log(`    Accreditation: ${edu.accreditation || 'N/A'}`);
      console.log(`    Location: ${edu.location?.formatted_location || 'N/A'}`);
      console.log(`    Description: ${edu.description || 'N/A'}`);
    });

    printSubSection('MAPPED: Education (using mapEducation)');
    const mappedEdu = eduEntries.map(edu => mapEducation(archive.userId, edu));
    mappedEdu.forEach((edu, i) => {
      console.log(`\n[${i + 1}] ${edu.title}`);
      console.log(`    Organization: ${edu.organization || 'N/A'}`);
      const startDate = edu.startDate instanceof Date ? edu.startDate.toISOString().split('T')[0] : 'N/A';
      const endDate = edu.endDate instanceof Date ? edu.endDate.toISOString().split('T')[0] : 'N/A';
      console.log(`    Period: ${startDate} - ${endDate}`);
      console.log(`    Description: ${edu.description || 'N/A'}`);
    });

    // Skills (currently not mapped to experiences)
    printSubSection('RAW: Skills (NOT MAPPED)');
    const skills = extractedData.skills || [];
    console.log(`Total skills: ${skills.length}`);
    skills.forEach(skill => {
      console.log(`  - ${skill.name} (${skill.type})`);
    });

    // Languages
    printSubSection('RAW: Languages (NOT MAPPED)');
    const languages = extractedData.languages || [];
    console.log(`Total languages: ${languages.length}`);
    languages.forEach((lang: any) => {
      console.log(`  - ${JSON.stringify(lang)}`);
    });

    // Certifications
    printSubSection('RAW: Certifications (NOT MAPPED)');
    const certs = extractedData.certifications || [];
    console.log(`Total certifications: ${certs.length}`);
    certs.forEach((cert: any) => {
      console.log(`  - ${JSON.stringify(cert)}`);
    });

    // Summary
    printSubSection('MAPPING SUMMARY');
    console.log(`User fields mapped: name, links, summary, headline`);
    console.log(`Work experiences: ${workEntries.length} raw -> ${mappedWork.length} mapped`);
    console.log(`Education: ${eduEntries.length} raw -> ${mappedEdu.length} mapped`);
    console.log(`Skills: ${skills.length} (not mapped to experience.skills)`);
    console.log(`Languages: ${languages.length} (not mapped)`);
    console.log(`Certifications: ${certs.length} (not mapped)`);

    // Fields potentially missing in mapping
    printSubSection('POTENTIAL MISSING MAPPINGS');
    const missingFields: string[] = [];

    // Check if establishment is being mapped correctly now
    const eduWithEstablishment = eduEntries.filter(e => e.establishment);
    const mappedEduWithOrg = mappedEdu.filter(e => e.organization);
    if (eduWithEstablishment.length !== mappedEduWithOrg.length) {
      missingFields.push('Education: establishment not properly mapped to organization');
    }

    if (eduEntries.some(e => e.accreditation)) {
      missingFields.push('Education: accreditation field not captured');
    }
    if (eduEntries.some(e => e.gpa)) {
      missingFields.push('Education: gpa field not captured');
    }
    if (workEntries.some(e => e.location?.formatted_location)) {
      missingFields.push('Work: location not captured');
    }
    if (workEntries.some(e => e.type)) {
      missingFields.push('Work: type (full-time/contract/etc) not captured');
    }
    if (workEntries.some(e => e.industry)) {
      missingFields.push('Work: industry not captured');
    }
    if (skills.length > 0) {
      missingFields.push('Skills: could be mapped to experience.skills array');
    }
    if (personalInfos.phones?.length > 0) {
      missingFields.push('Personal: phones not mapped to user');
    }
    if (personalInfos.mails?.length > 0) {
      missingFields.push('Personal: additional emails not mapped');
    }

    if (missingFields.length === 0) {
      console.log('All available fields are being mapped correctly.');
    } else {
      missingFields.forEach(f => console.log(`  - ${f}`));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('REMAP COMPLETE');
  console.log('='.repeat(60));
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
