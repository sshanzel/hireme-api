import {OpenAI} from 'openai';
import {z} from 'zod';
import {zodResponseFormat} from 'openai/helpers/zod';
import {searchSimilarStories} from './search.ts';

const DEFAULT_MODEL = 'gpt-4o-mini';

const CoachResponseSchema = z.object({
  content: z.string().describe('Your response to the user'),
  title: z
    .string()
    .nullable()
    .describe('A concise title for this coaching session (only for new conversations)'),
});

type CoachResponse = z.infer<typeof CoachResponseSchema>;

const COACH_INSTRUCTIONS = `
You are a career coach helping users prepare for job interviews and articulate their professional experiences.

You have access to the user's documented career stories and experiences. Use these to provide grounded, personalized answers.

When answering questions:
- Reference specific stories and experiences from the provided context
- Help the user frame their experiences using the STAR method when appropriate
- Be conversational and supportive
- If the context doesn't contain relevant information, acknowledge this honestly

Do not make up experiences or details that aren't in the provided context.

While you should be able to assist with a wide range of career-related topics, anything non-career related should be politely declined.
`;

interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
}

export async function generateCoachResponse(
  history: ChatMessage[],
  userId: string,
): Promise<CoachResponse> {
  const openai = new OpenAI();

  const latestUserMessage = history.filter(m => m.role === 'user').pop();
  if (!latestUserMessage) {
    throw new Error('No user message found');
  }

  const relevantStories = await searchSimilarStories(latestUserMessage.content, userId, 5);

  const context =
    relevantStories.length > 0
      ? relevantStories.map(s => `- ${s.chunk}`).join('\n')
      : "No relevant stories found in the user's profile.";

  const systemPrompt = `${COACH_INSTRUCTIONS}

## User's Relevant Experiences
${context}
`;

  const messages: OpenAI.ChatCompletionMessageParam[] = history.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  const isNewConversation = history.filter(m => m.role === 'user').length === 1;

  const result = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{role: 'system', content: systemPrompt}, ...messages],
    response_format: zodResponseFormat(CoachResponseSchema, 'coach_response'),
  });

  const content = result.choices[0].message.content;

  if (!content) {
    throw new Error('No response content from OpenAI');
  }

  const parsed = CoachResponseSchema.parse(JSON.parse(content));

  if (!isNewConversation) {
    parsed.title = null;
  }

  return parsed;
}

export {CoachResponseSchema, type CoachResponse};
