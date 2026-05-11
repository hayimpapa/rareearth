// tools.js — the menu of tools the agent is allowed to use.
//
// In the Claude API, you don't "call" tools yourself ahead of time. You hand
// Claude a list of tool *definitions*, and Claude decides — turn by turn — which
// ones to invoke. We're using Anthropic's server-side tools here (`web_search`
// and `web_fetch`), which means Anthropic runs the actual search and fetch on
// their side and streams the results into Claude's context. We just declare
// them; the heavy lifting (HTTP, parsing, ranking) is hidden behind the API.
//
// If we ever added a *custom* tool (e.g. a stock quote lookup), it would live
// here too, with the same shape — `{ name, description, input_schema }` — and
// agent.js would need to execute it locally when Claude asks for it.

// web_search: lets the agent issue search queries. We deliberately *don't*
// pass `allowed_domains` — that field is a strict allowlist, and Anthropic
// rejects the whole request if any listed domain blocks their crawler in
// robots.txt (Reuters / Bloomberg / MarketWatch all do). Instead we steer the
// agent toward Seeking Alpha via PROMPTS.txt and let it fall back to whichever
// crawler-friendly outlets it finds organically.
export const webSearchTool = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
};

// web_fetch: lets the agent open a specific URL and read its contents. Same
// reasoning as above — no allowlist, since the model already biases toward
// Seeking Alpha and any blocked URL it tries just fails that one fetch
// instead of failing the whole request.
export const webFetchTool = {
  type: "web_fetch_20250910",
  name: "web_fetch",
  max_uses: 8,
  // Pull a generous slice of each article — Seeking Alpha pieces can be long.
  max_content_tokens: 20000,
};

// The full toolset, in the order the agent is most likely to use them.
export const tools = [webSearchTool, webFetchTool];

// Server-side tools need this beta header on the request.
export const toolBetas = ["web-fetch-2025-09-10"];
