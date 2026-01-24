import {db} from '../../db/index.ts';
import {
  profileChatTable,
  profileChatEventTable,
  userTable,
  MessageRole,
} from '../../db/schema/index.ts';
import {eq, and} from 'drizzle-orm';

export async function getUserById(userId: string) {
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {id: true, name: true, email: true},
  });

  return user || null;
}

export async function createProfileChat(userId: string, visitorIp: string, origin?: string) {
  const records = await db
    .insert(profileChatTable)
    .values({userId, visitorIp, origin: origin || null})
    .returning();

  return records[0];
}

export async function getProfileChatByVisitor(userId: string, visitorIp: string) {
  const record = await db.query.profileChatTable.findFirst({
    where: and(eq(profileChatTable.userId, userId), eq(profileChatTable.visitorIp, visitorIp)),
    orderBy: (profileChat, {desc}) => [desc(profileChat.createdAt)],
  });

  return record || null;
}

export async function getProfileChatWithEvents(id: string) {
  const record = await db.query.profileChatTable.findFirst({
    where: eq(profileChatTable.id, id),
  });

  if (!record) {
    return null;
  }

  const events = await db
    .select()
    .from(profileChatEventTable)
    .where(eq(profileChatEventTable.profileChatId, id))
    .orderBy(profileChatEventTable.createdAt);

  return {profileChat: record, events};
}

export async function getOrCreateProfileChat(userId: string, visitorIp: string, origin?: string) {
  const existing = await getProfileChatByVisitor(userId, visitorIp);

  if (existing) {
    const events = await db
      .select()
      .from(profileChatEventTable)
      .where(eq(profileChatEventTable.profileChatId, existing.id))
      .orderBy(profileChatEventTable.createdAt);

    return {profileChat: existing, events};
  }

  const profileChat = await createProfileChat(userId, visitorIp, origin);
  return {profileChat, events: []};
}

interface CreateProfileChatEventParams {
  profileChatId: string;
  content: string;
  role: MessageRole;
}

export async function createProfileChatEvent({
  profileChatId,
  content,
  role,
}: CreateProfileChatEventParams) {
  const events = await db
    .insert(profileChatEventTable)
    .values({profileChatId, content, role})
    .returning();

  return events[0];
}
