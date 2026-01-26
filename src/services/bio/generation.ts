import {OpenAI} from 'openai';
import {z} from 'zod';
import {zodResponseFormat} from 'openai/helpers/zod';
import {searchProfile, ProfileSearchResult} from './search.ts';

const DEFAULT_MODEL = 'gpt-4o-mini';

const ProfileResponseSchema = z.object({
  content: z.string().describe('Your response about the user'),
});

type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

function buildSystemPrompt(userName: string, context: ProfileSearchResult[]): string {
  const formattedContext =
    context.length > 0
      ? context.map(c => `[${c.type.toUpperCase()}] ${c.chunk}`).join('\n\n')
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
  const systemPrompt = buildSystemPrompt(userName, relevantContext);

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
