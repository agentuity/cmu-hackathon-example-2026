/**
 * Hackathon Scout Agent
 * 
 * This agent searches ArXiv for research papers and suggests hackathon project ideas.
 * It demonstrates a simple agentic pattern: fetch data → analyze with LLM → stream response.
 * 
 * Learn more: https://agentuity.dev/Agents
 */

import { createAgent } from '@agentuity/runtime';
import { s } from '@agentuity/schema';
import OpenAI from 'openai';

// OpenAI client - Agentuity's AI Gateway handles authentication
const openai = new OpenAI();

// Define input/output schemas using @agentuity/schema
// Docs: https://agentuity.dev/Agents/schemas
export const AgentInput = s.object({
	query: s.string().describe('The research topic to search for'),
	maxResults: s.number().optional().describe('Max papers to return (default 5)'),
});

export const AgentOutput = s.object({
	response: s.string().describe('AI analysis with papers and project ideas'),
});

// System prompt - instructions for the LLM
const SYSTEM_PROMPT = `You are a research paper scout that helps hackathon students find project ideas.

Given ArXiv API data, provide:

## Papers
For each paper, list:
- **Title** (with PDF link)
- Authors (first 3)
- One sentence summary
- Category (ML, AI Agents, GenAI, CV, NLP, or Other)

## Hackathon Project Ideas
2-3 creative project ideas inspired by the papers. For each:
- Project name
- One sentence pitch
- Why it's good for a hackathon (doable in 24-48 hours)

Be direct and concise. Do not ask follow-up questions - this is a one-shot response.`;

/**
 * Fetch papers from ArXiv API
 * ArXiv provides free access to research papers via a simple REST API
 */
export async function fetchArxiv(query: string, maxResults: number = 5): Promise<string> {
	const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${maxResults}&sortBy=relevance`;

	const response = await fetch(url);
	if (!response.ok) {
		return `Error: ArXiv API returned status ${response.status}`;
	}
	return response.text();
}

/**
 * Stream analysis from GPT-5
 * Uses OpenAI's streaming API to yield tokens as they're generated
 * Docs: https://platform.openai.com/docs/guides/streaming-responses
 */
export async function* streamAnalysis(query: string, arxivData: string): AsyncGenerator<string> {
	const stream = await openai.chat.completions.create({
		model: 'gpt-5',
		messages: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{ role: 'user', content: `Search query: "${query}"\n\nArXiv data:\n${arxivData}` },
		],
		stream: true,
	});

	for await (const chunk of stream) {
		const content = chunk.choices[0]?.delta?.content;
		if (content) yield content;
	}
}

/**
 * Agent Definition
 * 
 * createAgent() defines an agent with:
 * - name: unique identifier
 * - description: what the agent does
 * - schema: typed input/output using @agentuity/schema
 * - handler: the async function that runs when the agent is called
 * 
 * Docs: https://agentuity.dev/Agents/creating-agents
 */
const agent = createAgent('hackathon-scout', {
	description: 'Searches ArXiv for papers and suggests hackathon project ideas',
	schema: {
		input: AgentInput,
		output: AgentOutput,
	},
	handler: async (ctx, { query, maxResults = 5 }) => {
		ctx.logger.info('Hackathon Scout started', { query, maxResults });

		// 1. Fetch papers from ArXiv
		const arxivData = await fetchArxiv(query, maxResults);

		// 2. Stream analysis from LLM (collect all tokens for non-streaming response)
		let response = '';
		for await (const chunk of streamAnalysis(query, arxivData)) {
			response += chunk;
		}

		return { response };
	},
});

export default agent;
