/**
 * Hackathon Scout Agent
 *
 * This agent searches ArXiv for research papers and suggests hackathon project ideas.
 * It demonstrates a streaming agentic pattern: fetch data → analyze with LLM → stream response.
 *
 * Streams structured JSON-line events:
 * - tool_call: when a tool is invoked
 * - tool_result: when a tool returns
 * - llm_start: when LLM analysis begins
 * - token: each text chunk from the LLM
 * - complete: when processing finishes
 * - error: if something goes wrong
 *
 * Learn more: https://agentuity.dev/Agents
 */

import { createAgent } from '@agentuity/runtime';
import { s } from '@agentuity/schema';
import { stepCountIs, streamText, tool, zodSchema } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod/v4';
import { fetchArxiv } from './utils';

// Define input schema using @agentuity/schema
// Docs: https://agentuity.dev/Agents/schemas
export const AgentInput = s.object({
	query: s.string().describe('The research topic to search for'),
	maxResults: s.number().optional().describe('Max papers to return (default 5)'),
});

// Structured event types for streaming
type StreamEvent =
	| { type: 'tool_call'; tool: string; message: string; toolCallId?: string; input?: unknown }
	| { type: 'tool_result'; tool: string; message: string; toolCallId?: string; input?: unknown; output?: unknown }
	| { type: 'llm_start'; model: string; message: string }
	| { type: 'token'; content: string }
	| { type: 'complete'; message: string }
	| { type: 'error'; message: string };

// Helper to encode event as JSON line
const encodeEvent = (event: StreamEvent): string => JSON.stringify(event) + '\n';

const MODEL_NAME = 'gpt-5';

const tools = {
	arxiv_search: tool({
		description: 'Search ArXiv for papers by topic and return raw XML results.',
		inputSchema: zodSchema(z.object({
			query: z.string().describe('Search query for ArXiv'),
			maxResults: z.number().optional().describe('Maximum number of papers to return'),
		})),
		execute: async ({ query, maxResults }: { query: string; maxResults?: number }) =>
			fetchArxiv(query, maxResults ?? 5),
	}),
};

// System prompt - instructions for the LLM
const SYSTEM_PROMPT = `You are a research paper scout that helps hackathon students find project ideas.

Use the arxiv_search tool to fetch papers before you answer. The tool returns raw ArXiv XML.

Given ArXiv API data, provide:

## Papers
For each paper, output:
- [Title](pdf_url)
  Authors: <first 3>
  Category: <ML|AI Agents|GenAI|CV|NLP|Other>
  <one-sentence summary (no label)>

## Hackathon Project Ideas
2-3 creative project ideas inspired by the papers. For each:
- Project name
- One sentence pitch
- Why it's good for a hackathon (doable in 24-48 hours)

Be direct and concise. Do not ask follow-up questions - this is a one-shot response.`;

/**
 * Agent Definition
 *
 * createAgent() defines an agent with:
 * - name: unique identifier
 * - description: what the agent does
 * - schema: typed input with stream: true for streaming output
 * - handler: the async function that runs when the agent is called
 *
 * Docs: https://agentuity.dev/Agents/creating-agents
 */
const agent = createAgent('hackathon-scout', {
	description: 'Searches ArXiv for papers and suggests hackathon project ideas',
	schema: {
		input: AgentInput,
		stream: true, // Enable streaming output
	},
	handler: async (ctx, { query, maxResults = 5 }) => {
		ctx.logger.info('Hackathon Scout started', { query, maxResults });

		const result = streamText({
			model: openai(MODEL_NAME),
			system: SYSTEM_PROMPT,
			prompt: `Research topic: "${query}". Use arxiv_search with maxResults=${maxResults} and analyze the results.`,
			tools,
			stopWhen: stepCountIs(3), // Allow tool call step + answer step (default is 1, which stops after tool call)
		});

		const encoder = new TextEncoder();
		const formatEvent = (event: StreamEvent) => encoder.encode(encodeEvent(event));
		let llmStarted = false;

		const transform = new TransformStream({
			transform(chunk: { type: string; [key: string]: unknown }, controller) {
				switch (chunk.type) {
					case 'start':
					case 'start-step':
					case 'text-start':
						if (!llmStarted) {
							llmStarted = true;
							controller.enqueue(formatEvent({
								type: 'llm_start',
								model: MODEL_NAME,
								message: `Analyzing with ${MODEL_NAME}...`,
							}));
						}
						break;
					case 'tool-call':
						{
							const toolName = String(chunk.toolName ?? 'tool');
							const toolCallId = typeof chunk.toolCallId === 'string' ? chunk.toolCallId : undefined;
							const input = chunk.input;
						controller.enqueue(formatEvent({
							type: 'tool_call',
							tool: toolName,
							toolCallId,
							input,
							message: `Calling ${toolName}...`,
						}));
						break;
						}
					case 'tool-result': {
						const toolName = String(chunk.toolName ?? 'tool');
						const toolCallId = typeof chunk.toolCallId === 'string' ? chunk.toolCallId : undefined;
						const input = chunk.input;
						const output = chunk.output;
						let message = `${toolName} complete`;
						if (toolName === 'arxiv_search' && typeof output === 'string') {
							const paperCount = (output.match(/<entry>/g) || []).length;
							// Extract top 3 paper titles from XML
							const titleMatches = output.match(/<title>([^<]+)<\/title>/g) || [];
							// Skip first match (feed title), take next 3 (paper titles)
							const paperTitles = titleMatches
								.slice(1, 4)
								.map(t => t.replace(/<\/?title>/g, '').trim().replace(/\s+/g, ' '));
							if (paperTitles.length > 0) {
								const topTitles = paperTitles.join(' • ');
								message = `Found ${paperCount} papers. Top: ${topTitles}`;
							} else {
								message = `Found ${paperCount} papers`;
							}
						}
						controller.enqueue(formatEvent({
							type: 'tool_result',
							tool: toolName,
							toolCallId,
							input,
							output,
							message,
						}));
						break;
					}
					case 'text-delta':
						{
							const text = typeof chunk.text === 'string' ? chunk.text : '';
						controller.enqueue(formatEvent({
							type: 'token',
							content: text,
						}));
						break;
						}
					case 'finish':
						controller.enqueue(formatEvent({
							type: 'complete',
							message: 'Analysis complete',
						}));
						break;
					case 'tool-error':
					case 'error': {
						const errorMessage = chunk.type === 'tool-error'
							? `Tool error: ${String(chunk.error)}`
							: `Error: ${String(chunk.error)}`;
						controller.enqueue(formatEvent({
							type: 'error',
							message: errorMessage,
						}));
						break;
					}
					default:
						break;
				}
			},
		});

		return result.fullStream.pipeThrough(transform);
	},
});

export default agent;
