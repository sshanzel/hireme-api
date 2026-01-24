import {eq} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {experienceTable, experienceIndexTable, Experience} from '../../db/schema/index.ts';
import {fetchEmbedding} from '../story/storyProcessing.ts';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {year: 'numeric', month: 'short'});
}

export function buildExperienceChunk(exp: Experience): string {
  const parts = [
    `${exp.type}: ${exp.title}${exp.organization ? ` at ${exp.organization}` : ''}`,
    `Period: ${formatDate(exp.startDate)} - ${exp.endDate ? formatDate(exp.endDate) : 'Present'}`,
  ];

  if (exp.description) {
    parts.push(`Description: ${exp.description}`);
  }

  if (exp.skills?.length) {
    parts.push(`Skills: ${exp.skills.join(', ')}`);
  }

  return parts.join('\n');
}

export async function generateExperienceEmbedding(experienceId: string): Promise<void> {
  const experience = await db.query.experienceTable.findFirst({
    where: eq(experienceTable.id, experienceId),
  });

  if (!experience) {
    throw new Error('Experience not found');
  }

  const chunk = buildExperienceChunk(experience);
  const embedding = await fetchEmbedding(chunk);

  const metadata = {
    type: experience.type,
    title: experience.title,
    organization: experience.organization,
    skills: experience.skills,
    startDate: experience.startDate.toISOString(),
    endDate: experience.endDate?.toISOString() || null,
  };

  const exists = await db
    .select()
    .from(experienceIndexTable)
    .where(eq(experienceIndexTable.experienceId, experienceId))
    .limit(1);

  if (exists.length > 0) {
    await db
      .update(experienceIndexTable)
      .set({chunk, vector: embedding, metadata})
      .where(eq(experienceIndexTable.experienceId, experienceId));
  } else {
    await db.insert(experienceIndexTable).values({
      experienceId,
      chunk,
      vector: embedding,
      metadata,
    });
  }
}
