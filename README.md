# Hackathon Scout

An AI agent that searches ArXiv for research papers and suggests hackathon project ideas. Built with [Agentuity](https://agentuity.dev).

## What It Does

1. You enter a research topic (e.g., "AI agents", "diffusion models")
2. The agent fetches papers from ArXiv
3. GPT-5 analyzes the papers and suggests hackathon project ideas
4. Results stream to your browser in real-time

## Quick Start

### Install Agentuity

Reference the docs [here:](https://agentuity.dev/Get-Started/installation)

### Run the project

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Deploy
bun run deploy # or agentuity deploy
```

Open http://localhost:3500 in your browser.

## Project Structure

```
src/
  agent/hackathon-scout/   # The AI agent
    index.ts               # Fetches ArXiv, streams GPT-5 analysis
  api/
    index.ts               # Streaming endpoint with stream() middleware
  web/
    App.tsx                # React frontend with activity log
```

## Key Concepts

### Agent (`src/agent/hackathon-scout/index.ts`)

Uses `createAgent()` to define an agent with typed input/output schemas:

```typescript
const agent = createAgent('hackathon-scout', {
  description: 'Searches ArXiv for papers and suggests hackathon project ideas',
  schema: { input: AgentInput, output: AgentOutput },
  handler: async (ctx, { query }) => { ... }
});
```

### Streaming Route (`src/api/index.ts`)

Uses `stream()` middleware to stream agent output:

```typescript
api.post('/search', agent.validator(), stream(async (c) => {
  const body = await c.req.json();
  return agent.run(body);
}));
```

### Streaming Flow

The agent uses AI SDK tool-calling with `streamText` to generate responses. The API streams these via `stream()` middleware, and the React frontend consumes them with `useAPI` streaming—no SSE required.

### React Frontend (`src/web/App.tsx`)

Uses `useAPI` from `@agentuity/react` to receive streamed chunks:

```typescript
const { invoke } = useAPI({ route: 'POST /api/search' });
await invoke({ query, maxResults: 5 });
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run deploy` | Deploy to Agentuity cloud |

## Learn More

- [Agentuity Docs](https://agentuity.dev) - Full documentation
- [Creating Agents](https://agentuity.dev/Agents) - Agent development guide
- [Streaming Routes](https://agentuity.dev/Routes/streaming) - Real-time streaming
- [React Hooks](https://agentuity.dev/Frontend/react-hooks) - Frontend integration
