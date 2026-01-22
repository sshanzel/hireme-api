import {db} from '../db/index.ts';
import {userTable, experienceTable, storyRawTable, storyRawEventTable} from '../db/schema/index.ts';
import {eq, exists, and, isNull} from 'drizzle-orm';

export async function getFullProfile(userId: string) {
  // Get user
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      id: true,
      email: true,
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
    orderBy: experienceTable.startDate,
  });

  // Get untagged stories (no experienceId) that have at least one event
  const untaggedStories = await db
    .select({
      id: storyRawTable.id,
      title: storyRawTable.title,
      tags: storyRawTable.tags,
      createdAt: storyRawTable.createdAt,
      updatedAt: storyRawTable.updatedAt,
    })
    .from(storyRawTable)
    .where(
      and(
        eq(storyRawTable.userId, userId),
        isNull(storyRawTable.experienceId),
        exists(
          db
            .select()
            .from(storyRawEventTable)
            .where(eq(storyRawEventTable.storyRawId, storyRawTable.id))
        )
      )
    )
    .orderBy(storyRawTable.createdAt);

  return {
    user,
    experiences,
    untaggedStories,
  };
}
