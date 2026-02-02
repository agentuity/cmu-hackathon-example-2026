/**
 * API Routes
 *
 * This file defines HTTP endpoints that the frontend can call.
 * We use the stream() middleware to stream agent responses to the browser.
 *
 * Learn more: https://agentuity.dev/Routes
 */

import { createRouter, stream } from '@agentuity/runtime';
import agent, { AgentInput } from '../agent/hackathon-scout';

const api = createRouter();

/**
 * POST /api/search - Stream search results
 *
 * Uses stream() middleware to return the agent's textStream.
 * The agent handles fetching ArXiv data and streaming LLM analysis.
 *
 * Docs: https://agentuity.dev/Routes/streaming
 */
api.post('/search', agent.validator(), stream(async (c) => {
	const { query, maxResults } = (await c.req.json()) as {
		query: string;
		maxResults?: number;
	};
	return agent.run({ query, maxResults });
}));

/**
 * GET /api/prompts - Return example search prompts
 *
 * Simple JSON endpoint (not streaming) for the frontend to fetch example prompts.
 *
 * Docs: https://agentuity.dev/Routes/http
 */
api.get('/prompts', (c) => {
	return c.json({
		welcome: 'Hackathon Scout - Find research papers and get project ideas!',
		prompts: ['AI agents', 'diffusion models', 'reinforcement learning', 'LLM fine-tuning', 'computer vision'],
	});
});

export default api;
