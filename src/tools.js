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

// web_search: lets the agent issue search queries. We allow it to use this for
// a few rounds so it can refine queries ("seeking alpha rare earth" →
// "seekingalpha.com MP Materials May 2026").
export const webSearchTool = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
  // Scope the agent to financial-news-ish domains. Seeking Alpha is the
  // primary target; the others give it fallback context if SA blocks the
  // crawler.
  allowed_domains: [
    "seekingalpha.com",
    "finance.yahoo.com",
    "reuters.com",
    "bloomberg.com",
    "marketwatch.com",
    "fool.com",
  ],
};

// web_fetch: lets the agent open a specific URL and read its contents. The
// agent will normally pick URLs out of the search results above. We cap fetches
// so a runaway agent can't burn the whole budget on one query.
export const webFetchTool = {
  type: "web_fetch_20250910",
  name: "web_fetch",
  max_uses: 8,
  // Match the search scope so the agent can't be redirected somewhere weird.
  allowed_domains: [
    "seekingalpha.com",
    "finance.yahoo.com",
    "reuters.com",
    "bloomberg.com",
    "marketwatch.com",
    "fool.com",
  ],
  // Pull a generous slice of each article — Seeking Alpha pieces can be long.
  max_content_tokens: 20000,
};

// The full toolset, in the order the agent is most likely to use them.
export const tools = [webSearchTool, webFetchTool];

// Server-side tools need this beta header on the request.
export const toolBetas = ["web-fetch-2025-09-10"];
