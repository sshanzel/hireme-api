import {db} from '../db/index.ts';
import {storyTable, storyRawEventTable, StoryRawEventRole} from '../db/schema/index.ts';
import {eq, and} from 'drizzle-orm';

export async function createStoryRaw(userId: string, experienceId?: string) {
  const storyRaws = await db
    .insert(storyTable)
    .values({
      userId,
      experienceId,
    })
    .returning();

  return storyRaws[0];
}

export async function deleteStoryRaw(id: string, userId: string) {
  const existing = await getStoryRawById(id, userId);

  if (!existing) {
    return false;
  }

  // Delete events first (cascade)
  await db.delete(storyRawEventTable).where(eq(storyRawEventTable.storyRawId, id));
  await db.delete(storyTable).where(eq(storyTable.id, id));

  return true;
}

export async function getStoryRawsByUser(userId: string) {
  return db.select().from(storyTable).where(eq(storyTable.userId, userId));
}

export async function getStoryRawById(id: string, userId: string) {
  const storyRaws = await db
    .select()
    .from(storyTable)
    .where(and(eq(storyTable.id, id), eq(storyTable.userId, userId)));

  return storyRaws[0] || null;
}

export async function getStoryRawWithEvents(id: string, userId: string) {
  const storyRawRecord = await getStoryRawById(id, userId);

  if (!storyRawRecord) {
    return null;
  }

  const events = await db
    .select()
    .from(storyRawEventTable)
    .where(eq(storyRawEventTable.storyRawId, id));

  return {storyRaw: storyRawRecord, events};
}

export async function getOrCreateStoryRaw(userId: string, storyId?: string) {
  if (!storyId) {
    const storyRaw = await createStoryRaw(userId);

    return {storyRaw, events: []};
  }

  return getStoryRawWithEvents(storyId, userId);
}

interface UpdateStoryRawParams {
  title?: string;
  tags?: string[];
  experienceId?: string | null;
}

export async function updateStoryRaw(id: string, userId: string, params: UpdateStoryRawParams) {
  const existing = await getStoryRawById(id, userId);

  if (!existing) {
    return null;
  }

  const updateData: Record<string, unknown> = {updatedAt: new Date()};

  if (params.title !== undefined) {
    updateData.title = params.title;
  }

  if (params.tags !== undefined) {
    updateData.tags = params.tags;
  }

  if (params.experienceId !== undefined) {
    updateData.experienceId = params.experienceId;
  }

  const updated = await db
    .update(storyTable)
    .set(updateData)
    .where(eq(storyTable.id, id))
    .returning();

  return updated[0];
}

interface CreateStoryRawEventParams {
  userId: string;
  content: string;
  role: StoryRawEventRole;
  storyRawId: string;
}

export async function createStoryRawEvent({
  userId,
  content,
  role,
  storyRawId,
}: CreateStoryRawEventParams) {
  const storyRawRecord = await getStoryRawById(storyRawId, userId);

  const events = await db
    .insert(storyRawEventTable)
    .values({
      storyRawId: storyRawRecord.id,
      content,
      role,
    })
    .returning();

  return {event: events[0], storyRaw: storyRawRecord};
}
