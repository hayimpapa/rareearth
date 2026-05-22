// test/test-agent.js — manual smoke test. Assumes `npm start` is running.

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config();

const HOST = process.env.HOST || "127.0.0.1";
const URL = `http://${HOST}:${process.env.PORT || 3000}/analyze`;
const TOKEN = process.env.ANALYZE_TOKEN;
const QUERY =
  process.argv.slice(2).join(" ").trim() ||
  "What is the sentiment around rare earth mining companies on Seeking Alpha?";

const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);

// Extract the markdown analysis, skipping intermediate agent thinking.
function cleanAnalysis(text) {
  const m = text.match(/#\s*Rare Earth/i);
  return m ? text.slice(m.index) : text;
}

function printResult(r) {
  // Top: companies table (most actionable).
  if (r.companies?.length) {
    console.log("\n┌─ COMPANIES ──────────────────────────────────────────────────────────────┐");
    console.log(`│ ${pad("Name", 24)} ${pad("Tkr", 6)} ${pad("Sentiment", 10)} ${pad("Valuation", 12)}│`);
    console.log("├" + "─".repeat(75) + "┤");
    for (const c of r.companies) {
      const themes = c.themes?.length ? ` [${c.themes.slice(0, 2).join(", ")}]` : "";
      const row =
        `│ ${pad(c.name, 24)} ${pad(c.ticker || "—", 6)} ${pad(c.sentiment, 10)} ${pad(c.valuation, 12)}${themes}`.padEnd(75) + "│";
      console.log(row);
    }
    console.log("└" + "─".repeat(75) + "┘");
  }

  // Middle: agent's final analysis (stripped of "searching..." noise).
  console.log("\n" + cleanAnalysis(r.analysis || "").trim());

  // Bottom: compact source list.
  if (r.sources?.length) {
    const recent = r.sources.slice(0, 8);
    console.log("\n📚 Sources:");
    for (const s of recent) {
      const date = s.date ? ` (${s.date.split("T")[0]})` : "";
      console.log(`  • ${s.title}${date}`);
    }
    if (r.sources.length > 8) console.log(`  ... +${r.sources.length - 8} more`);
  }

  console.log(`\n⏱ Generated ${r.timestamp}`);
}

async function main() {
  if (!TOKEN) {
    console.error("ANALYZE_TOKEN is not set in .env.local — /analyze will reject the request.");
    process.exit(1);
  }
  console.log(`POST ${URL}\nquery: ${QUERY}\n`);

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": TOKEN,
    },
    body: JSON.stringify({ query: QUERY }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, body);
    process.exit(1);
  }
  printResult(body);
}

main().catch(err => {
  console.error("test failed:", err);
  process.exit(1);
});
