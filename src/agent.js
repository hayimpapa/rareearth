// agent.js — the heart of the agent.
//
// The mental model: we hand Claude a goal (the user query), a system prompt
// (PROMPTS.txt), and a list of tools (tools.js). Claude then runs a loop:
//
//   model thinks → wants a tool → tool runs → result back to model → repeat
//
// …until the model decides it's done and returns a final text answer.
//
// We're using Anthropic's *server-side* tools, so Anthropic runs `web_search`
// and `web_fetch` for us in the same API call. From the client's perspective
// that often looks like a single round-trip with `stop_reason: "end_turn"`.
// But the loop below still handles the general case — if `stop_reason` comes
// back as `"tool_use"` (which would happen if we ever add a custom client-side
// tool), we'd execute that tool and feed the result back in. Keeping the loop
// visible is the educational point of this file.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

import { tools, toolBetas } from "./tools.js";
import { extractCompanies } from "./analyzer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_PATH = path.resolve(__dirname, "..", "PROMPTS.txt");

// Load the system prompt at startup. Edit PROMPTS.txt to change agent behaviour
// without touching code.
const SYSTEM_PROMPT = fs.readFileSync(PROMPTS_PATH, "utf8");

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 4096;
const MAX_TURNS = 6; // safety cap on the loop

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Run the agent against a single user query.
 * Returns the raw analysis plus the structured artefacts the server returns.
 *
 * @param {string} userQuery
 */
export async function runAgent(userQuery) {
  console.log(`[agent] starting with query: ${userQuery}`);

  const messages = [{ role: "user", content: userQuery }];
  let finalText = "";
  /** @type {{title: string, url: string, date?: string}[]} */
  const sources = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`[agent] turn ${turn + 1}: calling model`);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools,
      betas: toolBetas,
      messages,
    });

    // Walk the response blocks. With server-side tools, Anthropic returns the
    // tool uses *and* their results inline as part of the assistant message.
    // We log them so the user can watch the agent reason.
    for (const block of response.content) {
      if (block.type === "text") {
        finalText += block.text;
      } else if (block.type === "server_tool_use") {
        console.log(`[agent]   → ${block.name}(${JSON.stringify(block.input)})`);
      } else if (block.type === "web_search_tool_result") {
        const hits = Array.isArray(block.content) ? block.content : [];
        console.log(`[agent]   ← web_search returned ${hits.length} hits`);
        for (const h of hits) {
          if (h?.url) {
            sources.push({
              title: h.title || h.url,
              url: h.url,
              date: h.page_age || h.published_date,
            });
          }
        }
      } else if (block.type === "web_fetch_tool_result") {
        const url = block.content?.url || block.content?.content?.url;
        console.log(`[agent]   ← web_fetch read ${url || "(unknown url)"}`);
      } else if (block.type === "tool_use") {
        // Client-side custom tool — we don't have any yet, but this is where
        // we'd dispatch it. Left as a hook for future tools (e.g. stock_quote).
        console.log(`[agent]   → (client tool) ${block.name}`);
      }
    }

    // Append whatever the assistant just produced so the next turn (if any)
    // has the full conversation.
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence") {
      console.log(`[agent] done (stop_reason=${response.stop_reason})`);
      break;
    }

    if (response.stop_reason === "tool_use") {
      // If we had client-side tools, we'd execute them here and push a user
      // message of role "user" with `tool_result` blocks. Server-side tools
      // don't need this; their results are already in the assistant content.
      // For now: just loop and let the model continue.
      continue;
    }

    if (response.stop_reason === "max_tokens") {
      console.warn("[agent] hit max_tokens, stopping");
      break;
    }
  }

  // De-dupe sources by URL, preserving first-seen order.
  const seen = new Set();
  const uniqueSources = sources.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  // Local heuristics on top of the agent's prose. The agent already labels
  // companies in its output; this catches anything it mentioned in passing
  // and gives us a structured array regardless.
  const companies = extractCompanies(finalText);

  return {
    analysis: finalText.trim(),
    companies,
    sources: uniqueSources,
    timestamp: new Date().toISOString(),
  };
}
