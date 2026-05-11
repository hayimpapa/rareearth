// test/test-agent.js — manual smoke test. Assumes `npm start` is running.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const URL = `http://localhost:${process.env.PORT || 3000}/analyze`;
const QUERY =
  process.argv.slice(2).join(" ").trim() ||
  "What is the sentiment around rare earth mining companies on Seeking Alpha?";

const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);

function printResult(r) {
  console.log("\n=== ANALYSIS ===\n");
  console.log(r.analysis || "(empty)");

  console.log("\n=== COMPANIES ===\n");
  if (!r.companies?.length) {
    console.log("(none detected by heuristics)");
  } else {
    console.log(pad("Name", 28), pad("Tkr", 6), pad("Sentiment", 10), pad("Valuation", 14), "Themes");
    console.log("-".repeat(90));
    for (const c of r.companies) {
      console.log(
        pad(c.name, 28),
        pad(c.ticker || "", 6),
        pad(c.sentiment, 10),
        pad(c.valuation, 14),
        (c.themes || []).join(", "),
      );
    }
  }

  console.log("\n=== SOURCES ===\n");
  if (!r.sources?.length) {
    console.log("(none)");
  } else {
    for (const s of r.sources) {
      console.log(`- ${s.title}`);
      console.log(`  ${s.url}${s.date ? `  (${s.date})` : ""}`);
    }
  }

  console.log(`\n(timestamp: ${r.timestamp})`);
}

async function main() {
  console.log(`POST ${URL}\nquery: ${QUERY}\n`);

  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
