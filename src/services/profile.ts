import {db} from '../db/index.ts';
import {userTable, experienceTable, storyTable, storyEventTable} from '../db/schema/index.ts';
import {eq, exists, and, isNull, desc, or} from 'drizzle-orm';

export async function getFullProfile(userId: string) {
  // Get user
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      id: true,
      email: true,
      username: true,
      name: true,
      links: true,
      summary: true,
      headline: true,
      cvUploadedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return null;
  }

  // Get experiences with their stories
  const experiences = await db.query.experienceTable.findMany({
    where: eq(experienceTable.userId, userId),
    with: {
      stories: {
        columns: {
          id: true,
          title: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: desc(experienceTable.startDate),
  });

  // Get untagged stories (no experienceId) that have at least one event
  const untaggedStories = await db
    .select({
      id: storyTable.id,
      title: storyTable.title,
      tags: storyTable.tags,
      createdAt: storyTable.createdAt,
      updatedAt: storyTable.updatedAt,
    })
    .from(storyTable)
    .where(
      and(
        eq(storyTable.userId, userId),
        isNull(storyTable.experienceId),
        exists(db.select().from(storyEventTable).where(eq(storyEventTable.storyId, storyTable.id))),
      ),
    )
    .orderBy(storyTable.createdAt);

  return {
    user,
    experiences,
    untaggedStories,
  };
}

export async function getPublicProfile(identifier: string) {
  return db.query.userTable.findFirst({
    where: or(eq(userTable.id, identifier), eq(userTable.username, identifier)),
    columns: {
      id: true,
      username: true,
      name: true,
      links: true,
      summary: true,
      headline: true,
    },
    with: {
      experiences: {
        columns: {
          id: true,
          type: true,
          title: true,
          organization: true,
          startDate: true,
          endDate: true,
          description: true,
          skills: true,
        },
        orderBy: desc(experienceTable.startDate),
      },
    },
  });
}
