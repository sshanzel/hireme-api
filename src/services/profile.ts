import {db} from '../db/index.ts';
import {experienceTable, storyTable, storyEventTable, userTable} from '../db/schema/index.ts';
import {eq, exists, and, isNull, desc, or} from 'drizzle-orm';
import {isUuid} from '../utils/sanitize.ts';

export async function getFullProfile(userId: string) {
  // Get user
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      id: true,
      email: true,
      username: true,
      name: true,
      githubUrl: true,
      linkedinUrl: true,
      websiteUrl: true,
      twitterUrl: true,
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
  const profile = await db.query.userTable.findFirst({
    where: isUuid(identifier)
      ? or(eq(userTable.id, identifier), eq(userTable.username, identifier))
      : eq(userTable.username, identifier),
    columns: {
      id: true,
      username: true,
      name: true,
      githubUrl: true,
      linkedinUrl: true,
      websiteUrl: true,
      twitterUrl: true,
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

  if (!profile) {
    return null;
  }

  const {headline, summary, ...publicProfile} = profile;

  return {
    ...publicProfile,
    title: headline,
    bio: summary,
  };
}

interface UpdateProfileParams {
  username?: string;
  name?: string;
  headline?: string | null;
  summary?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  twitterUrl?: string | null;
}

export async function updateProfile(userId: string, params: UpdateProfileParams) {
  const updateData: Record<string, unknown> = {updatedAt: new Date()};

  if (params.username !== undefined) updateData.username = params.username;
  if (params.name !== undefined) updateData.name = params.name;
  if (params.headline !== undefined) updateData.headline = params.headline;
  if (params.summary !== undefined) updateData.summary = params.summary;
  if (params.githubUrl !== undefined) updateData.githubUrl = params.githubUrl;
  if (params.linkedinUrl !== undefined) updateData.linkedinUrl = params.linkedinUrl;
  if (params.websiteUrl !== undefined) updateData.websiteUrl = params.websiteUrl;
  if (params.twitterUrl !== undefined) updateData.twitterUrl = params.twitterUrl;

  const updated = await db
    .update(userTable)
    .set(updateData)
    .where(eq(userTable.id, userId))
    .returning({
      id: userTable.id,
      email: userTable.email,
      username: userTable.username,
      name: userTable.name,
      headline: userTable.headline,
      summary: userTable.summary,
      githubUrl: userTable.githubUrl,
      linkedinUrl: userTable.linkedinUrl,
      websiteUrl: userTable.websiteUrl,
      twitterUrl: userTable.twitterUrl,
      updatedAt: userTable.updatedAt,
    });

  return updated[0] || null;
}
