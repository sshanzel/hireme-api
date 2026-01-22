import {db} from '../db/index.ts';
import {experienceTable, ExperienceType} from '../db/schema/index.ts';
import {eq, and} from 'drizzle-orm';

interface CreateExperienceParams {
  type: ExperienceType;
  title: string;
  organization?: string;
  startDate: Date;
  endDate?: Date;
  description?: string;
  skills?: string[];
}

interface UpdateExperienceParams {
  type?: ExperienceType;
  title?: string;
  organization?: string | null;
  startDate?: Date;
  endDate?: Date | null;
  description?: string | null;
  skills?: string[] | null;
}

export async function createExperience(userId: string, params: CreateExperienceParams) {
  const experiences = await db
    .insert(experienceTable)
    .values({
      userId,
      type: params.type,
      title: params.title,
      organization: params.organization || null,
      startDate: params.startDate,
      endDate: params.endDate || null,
      description: params.description || null,
      skills: params.skills || null,
    })
    .returning();

  return experiences[0];
}

export async function getExperienceById(id: string, userId: string) {
  const experiences = await db
    .select()
    .from(experienceTable)
    .where(and(eq(experienceTable.id, id), eq(experienceTable.userId, userId)));

  return experiences[0] || null;
}

export async function getExperiencesByUser(userId: string) {
  return db
    .select()
    .from(experienceTable)
    .where(eq(experienceTable.userId, userId))
    .orderBy(experienceTable.startDate);
}

export async function updateExperience(id: string, userId: string, params: UpdateExperienceParams) {
  const existing = await getExperienceById(id, userId);

  if (!existing) {
    return null;
  }

  const updateData: Record<string, unknown> = {updatedAt: new Date()};

  if (params.type !== undefined) {
    updateData.type = params.type;
  }
  if (params.title !== undefined) {
    updateData.title = params.title;
  }
  if (params.organization !== undefined) {
    updateData.organization = params.organization;
  }
  if (params.startDate !== undefined) {
    updateData.startDate = params.startDate;
  }
  if (params.endDate !== undefined) {
    updateData.endDate = params.endDate;
  }
  if (params.description !== undefined) {
    updateData.description = params.description;
  }
  if (params.skills !== undefined) {
    updateData.skills = params.skills;
  }

  const updated = await db
    .update(experienceTable)
    .set(updateData)
    .where(eq(experienceTable.id, id))
    .returning();

  return updated[0];
}

export async function deleteExperience(id: string, userId: string) {
  const existing = await getExperienceById(id, userId);

  if (!existing) {
    return false;
  }

  await db.delete(experienceTable).where(eq(experienceTable.id, id));

  return true;
}
