import {db} from '../../db/index.ts';
import {sql} from 'drizzle-orm';
import {fetchEmbedding} from '../story/storyProcessing.ts';

export interface ProfileSearchResult {
  type: 'story';
  id: string;
  sourceId: string;
  chunk: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export async function searchStories(
  query: string,
  userId: string,
  limit = 5,
): Promise<ProfileSearchResult[]> {
  const queryVector = await fetchEmbedding(query);

  const results = await db.execute(sql`
    SELECT
      'story' as type,
      si.id,
      si.story_id as "sourceId",
      si.chunk,
      si.metadata,
      1 - (si.vector <=> ${JSON.stringify(queryVector)}::vector) as similarity
    FROM story_index si
    INNER JOIN story s ON s.id = si.story_id
    WHERE s.user_id = ${userId}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  return results.rows as unknown as ProfileSearchResult[];
}
