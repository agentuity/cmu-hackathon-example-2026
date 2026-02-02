/**
 * Hackathon Scout - Frontend
 * 
 * A React frontend that connects to our agent via SSE (Server-Sent Events).
 * Shows real-time activity as the agent works: tool calls, LLM streaming, etc.
 * 
 * Key concepts:
 * - useEventStream: Agentuity hook for SSE connections
 * - Activity log: Shows what the agent is doing in real-time
 * - Token streaming: LLM response appears word-by-word
 * 
 * Learn more: https://agentuity.dev/Frontend/react-hooks
 */

import { useEventStream } from '@agentuity/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

// ----- Types -----

// Messages sent from the server via SSE
interface StreamMessage {
	type: 'tool_call' | 'tool_result' | 'llm_start' | 'token' | 'complete' | 'error';
	message?: string;
	content?: string;
}

// Activity log entry (tool calls, LLM activity, etc.)
interface ActivityEntry {
	id: number;
	type: string;
	message: string;
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
	const [activeQuery, setActiveQuery] = useState<string | null>(null);
	const [response, setResponse] = useState('');
	const [activities, setActivities] = useState<ActivityEntry[]>([]);
	const [status, setStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
	const activityIdRef = useRef(0);

	// Start a new search
	const handleSearch = useCallback((searchQuery: string) => {
		if (!searchQuery.trim()) return;
		setQuery(searchQuery);
		setResponse('');
		setActivities([]);
		setStatus('loading');
		activityIdRef.current = 0;
		setActiveQuery(searchQuery);
	}, []);

	// Add an activity to the log
	const handleActivity = useCallback((entry: Omit<ActivityEntry, 'id'>) => {
		setActivities(prev => [...prev, { ...entry, id: ++activityIdRef.current }]);
	}, []);

	// Update the streamed response text
	const handleStreamUpdate = useCallback((text: string) => {
		setResponse(text);
	}, []);

	// Mark search as complete
	const handleComplete = useCallback(() => {
		setStatus('complete');
		setActiveQuery(null);
	}, []);

	// Handle errors
	const handleError = useCallback((message: string) => {
		setStatus('error');
		handleActivity({ type: 'error', message });
		setActiveQuery(null);
	}, [handleActivity]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		handleSearch(query);
	};

	const isLoading = status === 'loading';

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
			{/* SSE Stream Component - only renders when searching */}
			{activeQuery && (
				<SearchStream
					query={activeQuery}
					onStreamUpdate={handleStreamUpdate}
					onActivity={handleActivity}
					onComplete={handleComplete}
					onError={handleError}
				/>
			)}

			{/* Header */}
			<header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto px-4 py-6">
					<h1 className="text-3xl font-bold text-white">🔬 Hackathon Scout</h1>
					<p className="text-purple-200 mt-1">
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
							className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
							disabled={isLoading}
						/>
						<button
							type="submit"
							disabled={!query.trim() || isLoading}
							className="px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center gap-2"
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

				{/* Activity Log - shows what the agent is doing */}
				{activities.length > 0 && (
					<div className="mb-6">
						<h2 className="text-sm font-medium text-white/60 mb-2">Agent Activity</h2>
						<div className="space-y-1">
							{activities.map((activity) => (
								<div
									key={activity.id}
									className="flex items-center gap-2 text-sm text-white/80 bg-white/5 rounded px-3 py-1.5"
								>
									<span>{activity.message}</span>
									{isLoading && activity.id === activities.length && <Spinner />}
								</div>
							))}
						</div>
					</div>
				)}

				{/* Error State */}
				{status === 'error' && (
					<div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200">
						Something went wrong. Please try again.
					</div>
				)}

				{/* Streaming Response */}
				{response && (
					<div className="mb-8">
						<h2 className="text-xl font-semibold text-white mb-4">💡 Results</h2>
						<div className="p-6 rounded-lg bg-white/5 border border-white/10 text-white/90 whitespace-pre-wrap leading-relaxed">
							{response}
							{isLoading && <span className="inline-block w-2 h-5 bg-purple-400 animate-pulse ml-0.5" />}
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
					<a href="https://agentuity.dev" className="text-purple-400 hover:underline">
						Agentuity
					</a>{' '}
					• Data from{' '}
					<a href="https://arxiv.org" className="text-purple-400 hover:underline">
						arXiv
					</a>
					{' • '}
					<a href="https://agentuity.devs" className="text-purple-400 hover:underline">
						Learn to build agents →
					</a>
				</div>
			</footer>
		</div>
	);
}

// ----- SearchStream Component -----

/**
 * Handles the SSE connection to the backend.
 * Uses useEventStream from @agentuity/react to receive real-time updates.
 * 
 * Why a separate component? The useEventStream hook connects immediately when mounted.
 * By only rendering this component when we have an activeQuery, we control when to connect.
 * 
 * Docs: https://agentuity.dev/Frontend/react-hooks#streaming-with-useeventstream
 */
function SearchStream({
	query,
	onStreamUpdate,
	onActivity,
	onComplete,
	onError,
}: {
	query: string;
	onStreamUpdate: (text: string) => void;
	onActivity: (entry: Omit<ActivityEntry, 'id'>) => void;
	onComplete: () => void;
	onError: (message: string) => void;
}) {
	// Accumulate tokens in a ref to avoid React state race conditions
	const textRef = useRef('');

	// Connect to the SSE endpoint
	const { data: rawData, error, close } = useEventStream('/api/search', {
		query: new URLSearchParams({ query, maxResults: '5' }),
	});

	// Handle incoming messages
	const data = rawData as StreamMessage | undefined;

	useEffect(() => {
		if (!data) return;

		switch (data.type) {
			case 'tool_call':
			case 'tool_result':
			case 'llm_start':
				onActivity({ type: data.type, message: data.message || '' });
				break;
			case 'token':
				// Accumulate tokens synchronously to avoid race conditions
				textRef.current += data.content || '';
				onStreamUpdate(textRef.current);
				break;
			case 'complete':
				onActivity({ type: 'complete', message: data.message || '✅ Done' });
				close();
				onComplete();
				break;
			case 'error':
				close();
				onError(data.message || 'An error occurred');
				break;
		}
	}, [data, close, onStreamUpdate, onActivity, onComplete, onError]);

	// Handle connection errors
	useEffect(() => {
		if (error) onError(error.message);
	}, [error, onError]);

	return null; // This component only handles the connection, no UI
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

export default App;
