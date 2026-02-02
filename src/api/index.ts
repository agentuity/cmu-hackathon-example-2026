/**
 * API Routes
 * 
 * This file defines HTTP endpoints that the frontend can call.
 * We use Server-Sent Events (SSE) to stream real-time updates to the browser.
 * 
 * Learn more: https://agentuity.dev/Routes
 */

import { createRouter, sse } from '@agentuity/runtime';
import { fetchArxiv, streamAnalysis } from '../agent/hackathon-scout';

const api = createRouter();

/**
 * GET /api/search - Stream search results via SSE
 * 
 * SSE (Server-Sent Events) allows us to push updates to the browser in real-time.
 * This is perfect for streaming LLM responses token-by-token.
 * 
 * Docs: https://agentuity.dev/Routes/sse
 */
api.get(
	'/search',
	sse(async (c, stream) => {
		const query = c.req.query('query') || 'AI agents';
		const maxResults = parseInt(c.req.query('maxResults') || '5', 10);

		// Helper to send SSE events (with small delay to prevent message merging)
		const send = async (event: object) => {
			await stream.writeSSE({ data: JSON.stringify(event) });
			await new Promise(r => setTimeout(r, 5));
		};

		try {
			// Step 1: Search ArXiv (tool call)
			await send({
				type: 'tool_call',
				tool: 'arxiv_search',
				message: `🔍 Searching ArXiv for "${query}"...`,
			});

			const arxivData = await fetchArxiv(query, maxResults);
			const paperCount = (arxivData.match(/<entry>/g) || []).length;

			await send({
				type: 'tool_result',
				tool: 'arxiv_search',
				message: `📄 Found ${paperCount} papers`,
			});

			// Step 2: Analyze with LLM
			await send({
				type: 'llm_start',
				model: 'gpt-5',
				message: '🤖 Analyzing with GPT-5...',
			});

			// Step 3: Stream LLM response token-by-token
			for await (const chunk of streamAnalysis(query, arxivData)) {
				await send({ type: 'token', content: chunk });
			}

			// Done!
			await send({
				type: 'complete',
				message: '✅ Complete',
			});
		} catch (error) {
			await send({
				type: 'error',
				message: `❌ Error: ${String(error)}`,
			});
		}

		stream.close();
	})
);

/**
 * GET /api/prompts - Return example search prompts
 * 
 * Simple JSON endpoint (not SSE) for the frontend to fetch example prompts.
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
