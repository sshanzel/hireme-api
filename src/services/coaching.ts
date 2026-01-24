import {db} from '../db/index.ts';
import {coachingTable, coachingEventTable, MessageRole} from '../db/schema/index.ts';
import {eq, and} from 'drizzle-orm';

export async function createCoaching(userId: string) {
  const records = await db
    .insert(coachingTable)
    .values({userId})
    .returning();

  return records[0];
}

export async function deleteCoaching(id: string, userId: string) {
  const existing = await getCoachingById(id, userId);

  if (!existing) {
    return false;
  }

  await db.delete(coachingEventTable).where(eq(coachingEventTable.coachingId, id));
  await db.delete(coachingTable).where(eq(coachingTable.id, id));

  return true;
}

export async function getCoachingById(id: string, userId: string) {
  const records = await db
    .select()
    .from(coachingTable)
    .where(and(eq(coachingTable.id, id), eq(coachingTable.userId, userId)));

  return records[0] || null;
}

export async function getCoachingWithEvents(id: string, userId: string) {
  const record = await getCoachingById(id, userId);

  if (!record) {
    return null;
  }

  const events = await db
    .select()
    .from(coachingEventTable)
    .where(eq(coachingEventTable.coachingId, id));

  return {coaching: record, events};
}

export async function getOrCreateCoaching(userId: string, coachingId?: string) {
  if (!coachingId) {
    const coaching = await createCoaching(userId);
    return {coaching, events: []};
  }

  return getCoachingWithEvents(coachingId, userId);
}

export async function updateCoaching(id: string, userId: string, title: string) {
  const existing = await getCoachingById(id, userId);

  if (!existing) {
    return null;
  }

  const updated = await db
    .update(coachingTable)
    .set({title, updatedAt: new Date()})
    .where(eq(coachingTable.id, id))
    .returning();

  return updated[0];
}

interface CreateCoachingEventParams {
  coachingId: string;
  content: string;
  role: MessageRole;
}

export async function createCoachingEvent({coachingId, content, role}: CreateCoachingEventParams) {
  const events = await db
    .insert(coachingEventTable)
    .values({coachingId, content, role})
    .returning();

  return events[0];
}
