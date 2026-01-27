#!/usr/bin/env npx tsx
/**
 * Re-index all stories and experiences for a user
 * Usage: npx tsx bin/reindex-user.ts <userId>
 */
import 'dotenv/config';
import {eq} from 'drizzle-orm';
import {db} from '../src/db/index.ts';
import {experienceTable} from '../src/db/schema/experience.ts';
import {summarizeStory, generateStoryEmbedding} from '../src/services/story/storyProcessing.ts';
import {generateExperienceEmbedding} from '../src/services/experience/experienceProcessing.ts';

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: npx tsx bin/reindex-user.ts <userId>');
    process.exit(1);
  }

  console.log(`Re-indexing user: ${userId}\n`);

  // Fetch stories with their events using relational query
  const stories = await db.query.storyTable.findMany({
    where: (story, {eq}) => eq(story.userId, userId),
    with: {events: true},
  });

  // Filter stories with at least 2 events
  const validStories = stories.filter(s => s.events && s.events.length >= 2);

  console.log(`Found ${validStories.length} stories with 2+ events`);

  for (const story of validStories) {
    console.log(`  Processing story: ${story.id}`);
    const summary = await summarizeStory(story);
    if (summary) {
      await generateStoryEmbedding(story.id, summary);
      console.log(`    Indexed`);
    } else {
      console.log(`    Skipped (no summary)`);
    }
  }

  // Fetch all experiences
  const experiences = await db
    .select()
    .from(experienceTable)
    .where(eq(experienceTable.userId, userId));

  console.log(`\nFound ${experiences.length} experiences`);

  for (const exp of experiences) {
    console.log(`  Processing experience: ${exp.title}`);
    await generateExperienceEmbedding(exp.id);
    console.log(`    Indexed`);
  }

  console.log('\nRe-indexing complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
