import {StoryRawEventRole} from '../db/schema/storyRawEvent.ts';
import {OpenAI} from 'openai';
import {z} from 'zod';
import {zodResponseFormat} from 'openai/helpers/zod';

const DEFAULT_MODEL = 'gpt-4o-mini';

// Response schema for structured output
const StoryResponseSchema = z.object({
  content: z.string().describe('Your conversational response to the user'),
  title: z
    .string()
    .nullable()
    .describe(
      'A concise title for this story (only if this is a new conversation, otherwise null)'
    ),
  tags: z
    .array(z.string())
    .nullable()
    .describe(
      'Observed traits/signals from the conversation such as leadership, ownership, technical-depth, problem-solving, collaboration, impact, initiative, adaptability (only if this is a new conversation, otherwise null)'
    ),
});

type StoryResponse = z.infer<typeof StoryResponseSchema>;

const STORY_TELLER_INSTRUCTIONS = `
  You are a career coach helping users articulate individual career stories that will later be distilled into resume-ready signals.

  Each session focuses on one specific story tied to a work experience, project, or educational background. Your goal is to help the user clearly express what happened, what they did, and why it mattered—without overwhelming them.

  Engage conversationally. Ask relevant follow-up questions only when needed to clarify or strengthen the story. The user’s first message may already contain most of the necessary information—recognize this and avoid unnecessary probing.

  An effective story generally includes:
  1. Context – What was the situation?
  2. Constraints / Trade-offs – What challenges, limitations, or decisions were involved?
  3. Action – What actions did the user take?
  4. Result – What outcomes or impact followed?

  Do not explicitly force the user to answer each category. Instead, ensure the story is complete and compelling in a natural way.

  Before responding, decide whether the story is complete enough to stand on its own.
  - If it is complete: summarize and refine it into a clear, compelling narrative and end your response without asking further questions.
  - If it is missing a critical element: ask at most one gentle follow-up question at the very end.

  If sufficient detail is already present, prioritize refining, structuring, and synthesizing the story rather than asking for more information. You may respond with a short, compelling summary that highlights signals such as ownership, leadership, problem-solving, collaboration, or impact—only if they naturally emerge.

  Example: As an OSS contributor, when a project migrated to a new language and an existing feature was dropped, the user proactively rewrote it, demonstrating ownership and ensuring valuable ideas survived a major transition.

  If a list of the user’s employment history, projects, or education is provided:
  - Infer which role or experience this story most likely belongs to.
  - Only ask for clarification if the association is unclear.

  Once the story is coherent, there is no need to extend the conversation unnecessarily. The goal is clarity, not exhaustiveness.

  Keep responses conversational, supportive, and focused on helping the user feel heard. Avoid rigid formats, long checklists, recommendations, or advice. We are only collecting and refining stories at this stage.

  As you refine the story, internally note which signals naturally emerge (e.g. ownership, leadership, technical depth, impact, ambiguity), but do not force or exaggerate them if they are not present.

  You refined but you don't have to tell the user you did so.

  Always respond in the specified structured format.

`;

const format = {
  content: 'Your conversational response',
  title: 'A concise, appealing title for the story',
  tags: 'Array of observed traits/signals (e.g., ["leadership", "technical-depth", "ownership"])',
};

const conversationFormat = `

  ## Response Format
  You will respond in a structured format with the following fields:
  - content: Your conversational response
  - title: A concise, appealing title that displays the signals we found (e.g., "Leading Cloud Migration at Scale", "Debugging Production Outage Under Pressure"). Probably 5 words or less.
  - tags: Array of observed traits/signals (e.g., ["leadership", "technical-depth", "ownership"])
`;

interface ChatMessage {
  content: string;
  role: StoryRawEventRole;
}

const getFormat = (isNew: boolean) => {
  const props = isNew ? format : {content: format.content};

  const formatting = `
    ## Response Format
    You will respond in a structured format with the following fields:
    ${Object.entries(props)
      .map(([key, desc]) => `- ${key}: ${desc}`)
      .join('\n    ')}
  `;
  return formatting;
};

export async function generateResponse(history: ChatMessage[]): Promise<StoryResponse> {
  const openai = new OpenAI();

  // New conversation = only 1 user message in history
  const isNewConversation = history.filter(m => m.role === StoryRawEventRole.User).length === 1;
  const formatting = getFormat(isNewConversation);

  // Build the instruction with context about whether this is a new conversation
  const contextualInstruction = `${STORY_TELLER_INSTRUCTIONS}${formatting}`;

  // Convert history to OpenAI message format
  const messages: OpenAI.ChatCompletionMessageParam[] = history.map(msg => ({
    role: msg.role === StoryRawEventRole.User ? 'user' : 'assistant',
    content: msg.content,
  }));

  const result = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{role: 'system', content: contextualInstruction}, ...messages],
    response_format: zodResponseFormat(StoryResponseSchema, 'story_response'),
  });

  const content = result.choices[0].message.content;

  if (!content) {
    throw new Error('No response content from OpenAI');
  }

  const parsed = StoryResponseSchema.parse(JSON.parse(content));

  return parsed;
}

export {StoryResponseSchema, type StoryResponse};
