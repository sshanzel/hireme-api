import {db} from '../db/index.ts';
import {storyRawTable, storyRawEventTable, StoryRawEventType} from '../db/schema/index.ts';
import {eq, and} from 'drizzle-orm';

export async function createStoryRaw(userId: string, experienceId?: string) {
  const title = `Story - ${new Date().toISOString()}`;

  const storyRaws = await db
    .insert(storyRawTable)
    .values({
      userId,
      experienceId,
      title,
    })
    .returning();

  return storyRaws[0];
}

interface GetOrCreateStoryRawParams {
  experienceId: string;
  storyId: string;
}

export async function deleteStoryRaw(id: string, userId: string) {
  const existing = await getStoryRawById(id, userId);

  if (!existing) {
    return false;
  }

  await db.delete(storyRawTable).where(eq(storyRawTable.id, id));

  return true;
}

export async function getStoryRawsByUser(userId: string) {
  return db.select().from(storyRawTable).where(eq(storyRawTable.userId, userId));
}

export async function getStoryRawById(id: string, userId: string) {
  const storyRaws = await db
    .select()
    .from(storyRawTable)
    .where(and(eq(storyRawTable.id, id), eq(storyRawTable.userId, userId)));

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

export async function updateStoryRaw(id: string, userId: string, title: string) {
  const existing = await getStoryRawById(id, userId);

  if (!existing) {
    return null;
  }

  const updated = await db
    .update(storyRawTable)
    .set({title, updatedAt: new Date()})
    .where(eq(storyRawTable.id, id))
    .returning();

  return updated[0];
}

interface CreateStoryRawEventParams {
  userId: string;
  content: string;
  type: StoryRawEventType;
  storyRawId: string;
}

export async function createStoryRawEvent({
  userId,
  content,
  type,
  storyRawId,
}: CreateStoryRawEventParams) {
  const storyRawRecord = await getStoryRawById(storyRawId, userId);

  const events = await db
    .insert(storyRawEventTable)
    .values({
      storyRawId: storyRawRecord.id,
      content,
      type,
    })
    .returning();

  return {event: events[0], storyRaw: storyRawRecord};
}

export async function updateStoryRawEvent(id: string, userId: string, content: string) {
  const eventRecord = await db
    .select()
    .from(storyRawEventTable)
    .where(eq(storyRawEventTable.id, id));

  if (!eventRecord[0]) {
    return null;
  }

  const storyRawRecord = await getStoryRawById(eventRecord[0].storyRawId, userId);

  if (!storyRawRecord) {
    return null;
  }

  const updated = await db
    .update(storyRawEventTable)
    .set({content, updatedAt: new Date()})
    .where(eq(storyRawEventTable.id, id))
    .returning();

  return updated[0];
}

export async function deleteStoryRawEvent(id: string, userId: string) {
  const eventRecord = await db
    .select()
    .from(storyRawEventTable)
    .where(eq(storyRawEventTable.id, id));

  if (!eventRecord[0]) {
    return false;
  }

  const storyRawRecord = await getStoryRawById(eventRecord[0].storyRawId, userId);

  if (!storyRawRecord) {
    return false;
  }

  await db.delete(storyRawEventTable).where(eq(storyRawEventTable.id, id));

  return true;
}
