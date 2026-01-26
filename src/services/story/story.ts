import {db} from '../../db/index.ts';
import {storyTable, storyEventTable, storyIndexTable, MessageRole} from '../../db/schema/index.ts';
import {eq, and} from 'drizzle-orm';

export async function createStory(userId: string, experienceId?: string) {
  const stories = await db
    .insert(storyTable)
    .values({
      userId,
      experienceId,
    })
    .returning();

  return stories[0];
}

export async function deleteStory(id: string, userId: string) {
  const existing = await getStoryById(id, userId);

  if (!existing) {
    return false;
  }

  await db.transaction(async trx => {
    await trx.delete(storyEventTable).where(eq(storyEventTable.storyId, id));
    await trx.delete(storyIndexTable).where(eq(storyIndexTable.storyId, id));
    await trx.delete(storyTable).where(eq(storyTable.id, id));
  });

  return true;
}

export async function getStoriesByUser(userId: string) {
  return db.select().from(storyTable).where(eq(storyTable.userId, userId));
}

export async function getStoryById(id: string, userId: string) {
  const stories = await db
    .select()
    .from(storyTable)
    .where(and(eq(storyTable.id, id), eq(storyTable.userId, userId)));

  return stories[0] || null;
}

export async function getStoryWithEvents(id: string, userId: string) {
  const storyRecord = await getStoryById(id, userId);

  if (!storyRecord) {
    return null;
  }

  const events = await db.select().from(storyEventTable).where(eq(storyEventTable.storyId, id));

  return {story: storyRecord, events};
}

export async function getOrCreateStory(userId: string, storyId?: string) {
  if (!storyId) {
    const story = await createStory(userId);

    return {story, events: []};
  }

  return getStoryWithEvents(storyId, userId);
}

interface UpdateStoryParams {
  title?: string;
  tags?: string[];
  experienceId?: string | null;
}

export async function updateStory(id: string, userId: string, params: UpdateStoryParams) {
  const existing = await getStoryById(id, userId);

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

interface CreateStoryEventParams {
  userId: string;
  content: string;
  role: MessageRole;
  storyId: string;
}

export async function createStoryEvent({userId, content, role, storyId}: CreateStoryEventParams) {
  const storyRecord = await getStoryById(storyId, userId);

  const events = await db
    .insert(storyEventTable)
    .values({
      storyId: storyRecord.id,
      content,
      role,
    })
    .returning();

  return {event: events[0], story: storyRecord};
}
