import {db} from '../db/index.ts';
import {sql} from 'drizzle-orm';
import {fetchEmbedding} from './storyProcessing.ts';

export interface SearchResult {
  id: string;
  storyId: string;
  chunk: string;
  similarity: number;
}

export async function searchSimilarStories(
  query: string,
  userId: string,
  limit = 5,
): Promise<SearchResult[]> {
  const queryVector = await fetchEmbedding(query);

  const results = await db.execute(sql`
    SELECT
      si.id,
      si.story_id as "storyId",
      si.chunk,
      1 - (si.vector <=> ${JSON.stringify(queryVector)}::vector) as similarity
    FROM story_index si
    INNER JOIN story s ON s.id = si.story_id
    WHERE s.user_id = ${userId}
    ORDER BY si.vector <=> ${JSON.stringify(queryVector)}::vector
    LIMIT ${limit}
  `);

  return results.rows as unknown as SearchResult[];
}
