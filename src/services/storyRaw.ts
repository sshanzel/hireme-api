import {db} from '../db/index.ts';
import {storyRaw, storyRawEvent, StoryRawEventType} from '../db/schema/index.ts';
import {eq, and} from 'drizzle-orm';

export async function createStoryRaw(userId: string, experienceId?: string) {
  const title = `Story - ${new Date().toISOString()}`;

  const storyRaws = await db
    .insert(storyRaw)
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

  await db.delete(storyRaw).where(eq(storyRaw.id, id));

  return true;
}

export async function getStoryRawsByUser(userId: string) {
  return db.select().from(storyRaw).where(eq(storyRaw.userId, userId));
}

export async function getStoryRawById(id: string, userId: string) {
  const storyRaws = await db
    .select()
    .from(storyRaw)
    .where(and(eq(storyRaw.id, id), eq(storyRaw.userId, userId)));

  return storyRaws[0] || null;
}

export async function getStoryRawWithEvents(id: string, userId: string) {
  const storyRawRecord = await getStoryRawById(id, userId);

  if (!storyRawRecord) {
    return null;
  }

  const events = await db.select().from(storyRawEvent).where(eq(storyRawEvent.storyRawId, id));

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
    .update(storyRaw)
    .set({title, updatedAt: new Date()})
    .where(eq(storyRaw.id, id))
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
    .insert(storyRawEvent)
    .values({
      storyRawId: storyRawRecord.id,
      content,
      type,
    })
    .returning();

  return {event: events[0], storyRaw: storyRawRecord};
}

export async function updateStoryRawEvent(id: string, userId: string, content: string) {
  const eventRecord = await db.select().from(storyRawEvent).where(eq(storyRawEvent.id, id));

  if (!eventRecord[0]) {
    return null;
  }

  const storyRawRecord = await getStoryRawById(eventRecord[0].storyRawId, userId);

  if (!storyRawRecord) {
    return null;
  }

  const updated = await db
    .update(storyRawEvent)
    .set({content, updatedAt: new Date()})
    .where(eq(storyRawEvent.id, id))
    .returning();

  return updated[0];
}

export async function deleteStoryRawEvent(id: string, userId: string) {
  const eventRecord = await db.select().from(storyRawEvent).where(eq(storyRawEvent.id, id));

  if (!eventRecord[0]) {
    return false;
  }

  const storyRawRecord = await getStoryRawById(eventRecord[0].storyRawId, userId);

  if (!storyRawRecord) {
    return false;
  }

  await db.delete(storyRawEvent).where(eq(storyRawEvent.id, id));

  return true;
}
