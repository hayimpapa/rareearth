# Rare Earth Mining Sentiment Agent

## What we're building
An agent that searches Seeking Alpha for rare earth mining articles (last 7 days),
reads them, and produces a structured sentiment + valuation report with source links.

The point of this project is to learn how *agents* work. An agent is just Claude
deciding which tools to use to accomplish a goal. We do not script the steps —
we describe the goal and the tools, and Claude figures out the workflow:
"search → fetch the top results → summarize → maybe search again if I need more".

## Audience
The author is learning how agents work, not a professional developer. Code should
favour readability over cleverness. Comments explain *why* an agent design choice
was made, not what each line does.

## Tech stack
- Node.js (ES modules)
- Express — single POST `/analyze` endpoint
- `@anthropic-ai/sdk` — Claude API client
- Claude server-side tools (`web_search`, `web_fetch`) — Anthropic hosts the
  search index and fetcher; we just declare the tools and Claude uses them.

## Project layout
```
rare-earth-agent/
├── .env.local              # ANTHROPIC_API_KEY=...
├── .env.local.example      # template
├── package.json
├── CLAUDE.md               # this file
├── PROMPTS.txt             # the agent's system prompt (editable)
├── src/
│   ├── agent.js            # runAgent(query) — the tool-use loop
│   ├── tools.js            # tool definitions handed to Claude
│   ├── analyzer.js         # local heuristics (sentiment / valuation / themes)
│   ├── server.js           # Express server
│   └── types.js            # JSDoc typedefs describing the output shape
└── test/
    └── test-agent.js       # hits /analyze and pretty-prints the result
```

## Running
1. `cp .env.local.example .env.local` and put your key in it.
2. `npm install`
3. `npm start`              # starts the Express server on PORT (default 3000)
4. `npm test`               # in another terminal, hits POST /analyze

## Understanding the output
The `/analyze` endpoint returns:
```json
{
  "analysis": "free-text summary the agent wrote",
  "companies": [
    { "name": "MP Materials", "sentiment": "bullish",
      "valuation": "fairly_valued", "themes": ["supply_chain", "demand"] }
  ],
  "sources": [ { "title": "...", "url": "...", "date": "..." } ],
  "timestamp": "2026-05-11T..."
}
```
`companies`, themes, and the source list come from running the agent's prose
output through `analyzer.js` — simple keyword heuristics, easy to tweak.

## How the agent loop works (the educational bit)
In `src/agent.js`:
1. We call `messages.create` with the user query, the system prompt, and the
   list of tools.
2. Claude responds with either:
   - `stop_reason: "tool_use"` → it wants to call a tool. We execute the tool
     (or, with server-side tools, Anthropic already did) and feed the result
     back in.
   - `stop_reason: "end_turn"` → final answer; we return it.
3. The loop continues until Claude is done. Server-side tools (web_search,
   web_fetch) collapse most of this into a single API round-trip, but the
   structure is the same — and if we ever add a custom tool, the same loop
   handles it.

## Next steps
- React dashboard that calls `/analyze` and renders the companies table.
- Cron / scheduled daily runs that persist results.
- Add `stock_quote` as a real custom tool to wire in price data for a stronger
  valuation signal.
