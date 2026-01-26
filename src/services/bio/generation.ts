import {OpenAI} from 'openai';
import {z} from 'zod';
import {zodResponseFormat} from 'openai/helpers/zod';
import {eq, inArray} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {storyTable, experienceTable} from '../../db/schema/index.ts';
import {searchProfile, ProfileSearchResult} from './search.ts';

const DEFAULT_MODEL = 'gpt-4o-mini';

const ProfileResponseSchema = z.object({
  content: z.string().describe('Your response about the user'),
});

type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

interface ExperienceInfo {
  title: string;
  organization: string | null;
}

async function getStoryExperienceMap(storyIds: string[]): Promise<Map<string, ExperienceInfo>> {
  if (storyIds.length === 0) return new Map();

  const stories = await db
    .select({
      storyId: storyTable.id,
      experienceTitle: experienceTable.title,
      experienceOrg: experienceTable.organization,
    })
    .from(storyTable)
    .innerJoin(experienceTable, eq(storyTable.experienceId, experienceTable.id))
    .where(inArray(storyTable.id, storyIds));

  return new Map(
    stories.map(s => [s.storyId, {title: s.experienceTitle, organization: s.experienceOrg}]),
  );
}

function formatContextItem(c: ProfileSearchResult, experienceMap: Map<string, ExperienceInfo>): string {
  if (c.type === 'story') {
    const exp = experienceMap.get(c.sourceId);
    if (exp) {
      const expLabel = exp.organization ? `${exp.title} at ${exp.organization}` : exp.title;
      return `[STORY - Related to: ${expLabel}] ${c.chunk}`;
    }
  }
  return `[${c.type.toUpperCase()}] ${c.chunk}`;
}

function buildSystemPrompt(
  userName: string,
  context: ProfileSearchResult[],
  experienceMap: Map<string, ExperienceInfo>,
): string {
  const formattedContext =
    context.length > 0
      ? context.map(c => formatContextItem(c, experienceMap)).join('\n\n')
      : 'No relevant information found.';

  return `You are ${userName}, responding to questions on your public profile page.
Recruiters and hiring managers will ask you questions about your professional background.

Guidelines:
- Speak in first person as yourself (${userName})
- Answer based ONLY on the provided context about your experiences
- Be professional, personable, and authentic
- If asked about something not in the context, politely say you don't have that documented yet
- When relevant, mention specific companies, projects, or skills by name
- Keep responses concise and conversational
- You don't need to overly prettify the situation; just be clear and straightforward while adding the key points
- Always answer as yourself, never as an AI or third party

Your documented experiences:
${formattedContext}
`;
}

interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
}

export async function generateProfileResponse(
  history: ChatMessage[],
  userId: string,
  userName: string,
): Promise<ProfileResponse> {
  const openai = new OpenAI();

  const latestUserMessage = history.filter(m => m.role === 'user').pop();
  if (!latestUserMessage) {
    throw new Error('No user message found');
  }

  const relevantContext = await searchProfile(latestUserMessage.content, userId, 5);

  const storyIds = relevantContext.filter(c => c.type === 'story').map(c => c.sourceId);
  const experienceMap = await getStoryExperienceMap(storyIds);

  const systemPrompt = buildSystemPrompt(userName, relevantContext, experienceMap);

  const messages: OpenAI.ChatCompletionMessageParam[] = history.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  const result = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{role: 'system', content: systemPrompt}, ...messages],
    response_format: zodResponseFormat(ProfileResponseSchema, 'profile_response'),
  });

  const content = result.choices[0].message.content;

  if (!content) {
    throw new Error('No response content from OpenAI');
  }

  return ProfileResponseSchema.parse(JSON.parse(content));
}

export {ProfileResponseSchema, type ProfileResponse};
