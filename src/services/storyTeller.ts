import {Agent, run} from '@openai/agents';
import {StoryRawEventType} from '../db/schema/storyRawEvent.ts';
import {createStoryRawEvent} from './storyRaw.ts';
import openai, {OpenAI} from 'openai';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1500;
const DEFAULT_TOP_P = 0.9;
const DEFAULT_FREQUENCY_PENALTY = 0;
const DEFAULT_PRESENCE_PENALTY = 0;
const DEFAULT_STOP = ['\n\n'];
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY = 2000; // 2 seconds
const DEFAULT_LOGGING = true;
const DEFAULT_API_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_API_KEY = process.env.OPENAI_API_KEY || '';

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
`;

interface ChatStory {
  content: string;
  role: StoryRawEventType;
}

export const generateStoryAgent = (history: ChatStory[]) => {
  const agent = new Agent({
    name: 'Career coach',
    model: DEFAULT_MODEL,
    instructions: STORY_TELLER_INSTRUCTIONS,
  });

  return agent;
};

interface EventMessage {
  storyId?: string;
  content: string;
  type: 'ugc';
}

enum MessageType {
  StoryEvent = 'story-event',
  Response = 'response',
}

export const generateResponse = async (history: ChatStory[]) => {
  const openai = new OpenAI();
  const result = await openai.responses.create({
    model: 'gpt-4o-mini',
    instructions: STORY_TELLER_INSTRUCTIONS,
    input: history,
  });

  const response = JSON.stringify({
    type: MessageType.Response,
    data: result.output_text,
  });
  console.log('result.output:', result.output);
  console.log('result.finalOutput:', result.output_text);

  return response;
};
