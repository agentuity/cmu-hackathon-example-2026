/**
 * Hackathon Scout - Frontend
 *
 * A React frontend that connects to our agent via the Agentuity SDK.
 * Shows real-time activity log and LLM response as the agent works.
 *
 * Key concepts:
 * - useAPI for streaming responses with structured events
 * - Activity log: shows tool calls, LLM start, completion status
 * - Token streaming: LLM response appears word-by-word
 *
 * Learn more: https://agentuity.dev/Frontend/react-hooks
 */

import { useAPI } from '@agentuity/react';
import { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

// ----- Types -----

type StreamEvent =
	| { type: 'tool_call'; tool: string; message: string }
	| { type: 'tool_result'; tool: string; message: string }
	| { type: 'llm_start'; model: string; message: string }
	| { type: 'token'; content: string }
	| { type: 'complete'; message: string }
	| { type: 'error'; message: string };

interface ActivityItem {
	id: string;
	type: StreamEvent['type'];
	message: string;
	timestamp: Date;
}

// ----- Constants -----

const EXAMPLE_PROMPTS = [
	'AI agents',
	'diffusion models',
	'reinforcement learning',
	'LLM fine-tuning',
	'computer vision',
];

// ----- Main App Component -----

export function App() {
	const [query, setQuery] = useState('');
	const [response, setResponse] = useState('');
	const [activity, setActivity] = useState<ActivityItem[]>([]);
	const [status, setStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');

	const handleChunk = useCallback((chunk: unknown) => {
		// Parse the event - chunk may be string or already parsed object
		let event: StreamEvent;
		if (typeof chunk === 'string') {
			try {
				event = JSON.parse(chunk);
			} catch {
				return chunk;
			}
		} else {
			event = chunk as StreamEvent;
		}

		// Route event to appropriate handler
		switch (event.type) {
			case 'tool_call':
			case 'tool_result':
			case 'llm_start':
				setActivity(prev => [...prev, {
					id: `${event.type}-${Date.now()}`,
					type: event.type,
					message: event.message,
					timestamp: new Date(),
				}]);
				break;

			case 'token':
				setResponse(prev => prev + event.content);
				break;

			case 'complete':
				setActivity(prev => [...prev, {
					id: `complete-${Date.now()}`,
					type: 'complete',
					message: event.message,
					timestamp: new Date(),
				}]);
				setStatus('complete');
				break;

			case 'error':
				setActivity(prev => [...prev, {
					id: `error-${Date.now()}`,
					type: 'error',
					message: event.message,
					timestamp: new Date(),
				}]);
				setStatus('error');
				break;
		}

		return chunk;
	}, []);

	const { invoke, isLoading: isStreaming, error } = useAPI({
		route: 'POST /api/search',
		delimiter: '\n',
		onChunk: handleChunk,
	});

	// Start a new search
	const handleSearch = useCallback(async (searchQuery: string) => {
		if (!searchQuery.trim()) return;

		setQuery(searchQuery);
		setResponse('');
		setActivity([]);
		setStatus('loading');

		try {
			await invoke({ query: searchQuery, maxResults: 5 });
			// Status will be set by complete/error events
		} catch (err) {
			console.error('Search error:', err);
			setStatus('error');
		}
	}, [invoke]);

	useEffect(() => {
		if (error) {
			setStatus('error');
		}
	}, [error]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		handleSearch(query);
	};

	const isLoading = status === 'loading' || isStreaming;

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900">
			{/* Header */}
			<header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto px-4 py-6">
					<h1 className="text-3xl font-bold text-white">🔬 Hackathon Scout</h1>
					<p className="text-cyan-200 mt-1">
						Find research papers and get hackathon project ideas
					</p>
				</div>
			</header>

			<main className="max-w-4xl mx-auto px-4 py-8">
				{/* Search Form */}
				<form onSubmit={handleSubmit} className="mb-6">
					<div className="flex gap-3">
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
							placeholder="Search for research topics..."
							className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
							disabled={isLoading}
						/>
						<button
							type="submit"
							disabled={!query.trim() || isLoading}
							className="px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center gap-2"
						>
							{isLoading && <Spinner />}
							{isLoading ? 'Working...' : 'Search'}
						</button>
					</div>
				</form>

				{/* Example Prompts */}
				{status === 'idle' && (
					<div className="mb-8">
						<p className="text-white/60 text-sm mb-3">Try these topics:</p>
						<div className="flex flex-wrap gap-2">
							{EXAMPLE_PROMPTS.map((prompt) => (
								<button
									type="button"
									key={prompt}
									onClick={() => handleSearch(prompt)}
									className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
								>
									{prompt}
								</button>
							))}
						</div>
					</div>
				)}

				{/* Activity Log */}
				{activity.length > 0 && (
					<div className="mb-6">
						<h2 className="text-sm font-medium text-white/60 mb-2">Activity</h2>
						<div className="space-y-1">
							{activity.map((item) => (
								<div
									key={item.id}
									className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
										item.type === 'error'
											? 'bg-red-500/20 text-red-200'
											: item.type === 'complete'
											? 'bg-green-500/20 text-green-200'
											: 'bg-white/5 text-white/70'
									}`}
								>
									<ActivityIcon type={item.type} />
									<span>{item.message}</span>
								</div>
							))}
							{isLoading && status !== 'complete' && status !== 'error' && (
								<div className="px-3 py-2 rounded-lg text-sm flex items-center gap-2 bg-white/5 text-white/70">
									<Spinner />
									<span>Processing...</span>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Error State */}
				{status === 'error' && activity.length === 0 && (
					<div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200">
						Something went wrong. Please try again.
					</div>
				)}

				{/* Streaming Response */}
				{response && (
					<div className="mb-8">
						<h2 className="text-xl font-semibold text-white mb-4">💡 Results</h2>
						<div className="p-6 rounded-lg bg-white/5 border border-white/10 text-white/90 leading-relaxed prose prose-invert prose-cyan max-w-none">
							<ReactMarkdown
								components={{
									a: ({ node, ...props }) => (
										<a
											{...props}
											target="_blank"
											rel="noreferrer"
											className="text-cyan-300 hover:text-cyan-200 hover:underline"
										/>
									),
									p: ({ node, ...props }) => (
										<p {...props} className="mb-4 last:mb-0" />
									),
									ul: ({ node, ...props }) => (
										<ul {...props} className="list-disc list-inside mb-4 space-y-1" />
									),
									ol: ({ node, ...props }) => (
										<ol {...props} className="list-decimal list-inside mb-4 space-y-1" />
									),
									li: ({ node, ...props }) => (
										<li {...props} className="text-white/90" />
									),
									strong: ({ node, ...props }) => (
										<strong {...props} className="font-semibold text-white" />
									),
									h1: ({ node, ...props }) => (
										<h1 {...props} className="text-2xl font-bold text-white mb-3 mt-4 first:mt-0" />
									),
									h2: ({ node, ...props }) => (
										<h2 {...props} className="text-xl font-bold text-white mb-2 mt-3 first:mt-0" />
									),
									h3: ({ node, ...props }) => (
										<h3 {...props} className="text-lg font-semibold text-white mb-2 mt-3 first:mt-0" />
									),
								}}
							>
								{response}
							</ReactMarkdown>
							{isLoading && status !== 'complete' && <span className="inline-block w-2 h-5 bg-cyan-400 animate-pulse ml-0.5" />}
						</div>
					</div>
				)}

				{/* Empty State */}
				{status === 'idle' && !response && (
					<div className="text-center py-16 text-white/50">
						<p className="text-6xl mb-4">🔍</p>
						<p className="text-lg">Enter a research topic to discover papers and get hackathon ideas</p>
					</div>
				)}
			</main>

			{/* Footer */}
			<footer className="border-t border-white/10 py-6 mt-8">
				<div className="max-w-4xl mx-auto px-4 text-center text-white/40 text-sm">
					Built with{' '}
					<a href="https://agentuity.dev" className="text-cyan-400 hover:underline">
						Agentuity
					</a>{' '}
					• Data from{' '}
					<a href="https://arxiv.org" className="text-cyan-400 hover:underline">
						arXiv
					</a>
					{' • '}
					<a href="https://agentuity.dev" className="text-cyan-400 hover:underline">
						Learn to build agents →
					</a>
				</div>
			</footer>
		</div>
	);
}

// ----- Spinner Component -----

function Spinner() {
	return (
		<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	);
}

// ----- Activity Icon Component -----

function ActivityIcon({ type }: { type: StreamEvent['type'] }) {
	switch (type) {
		case 'tool_call':
			return <span className="text-blue-400">🔧</span>;
		case 'tool_result':
			return <span className="text-green-400">📄</span>;
		case 'llm_start':
			return <span className="text-cyan-400">🤖</span>;
		case 'complete':
			return <span className="text-green-400">✅</span>;
		case 'error':
			return <span className="text-red-400">❌</span>;
		default:
			return <span>•</span>;
	}
}

export default App;
