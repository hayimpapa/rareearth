// analyzer.js — local, deterministic post-processing of the agent's prose.
//
// The agent produces free-text analysis. We run that text through a few
// keyword heuristics so the API response has a *structured* `companies` array
// the frontend (or a downstream script) can render without re-parsing prose.
//
// These heuristics are intentionally simple. They are not a substitute for the
// agent's own judgement — the agent already labels each company in its prose
// (per PROMPTS.txt). This module is a safety net that also extracts whatever
// the agent mentions in passing.

// A small directory of rare-earth-adjacent miners + processors. Extend freely.
// Each entry: canonical name, ticker, regex of aliases to match in prose.
const COMPANY_DIRECTORY = [
  { name: "MP Materials",      ticker: "MP",    pattern: /\bMP Materials\b|\bMP\b(?=[\s,.])/i },
  { name: "Lynas Rare Earths", ticker: "LYC",   pattern: /\bLynas\b/i },
  { name: "Energy Fuels",      ticker: "UUUU",  pattern: /\bEnergy Fuels\b|\bUUUU\b/i },
  { name: "USA Rare Earth",    ticker: "USAR",  pattern: /\bUSA Rare Earth\b|\bUSAR\b/i },
  { name: "Ucore Rare Metals", ticker: "UCU",   pattern: /\bUcore\b/i },
  { name: "Iluka Resources",   ticker: "ILU",   pattern: /\bIluka\b/i },
  { name: "Arafura Rare Earths", ticker: "ARU", pattern: /\bArafura\b/i },
  { name: "Neo Performance Materials", ticker: "NEO", pattern: /\bNeo Performance\b/i },
  { name: "Critical Metals",   ticker: "CRML",  pattern: /\bCritical Metals\b|\bCRML\b/i },
  { name: "NioCorp",           ticker: "NB",    pattern: /\bNioCorp\b/i },
];

// Sentiment words. "bullish" / "bearish" win automatically; otherwise we count
// weaker signal words on each side.
const BULLISH_WORDS = [
  "bullish", "buy", "outperform", "undervalued", "upside", "growth",
  "tailwind", "strong demand", "rally", "breakout", "accumulate",
];
const BEARISH_WORDS = [
  "bearish", "sell", "underperform", "overvalued", "downside", "headwind",
  "weak demand", "decline", "selloff", "avoid", "downgrade",
];

// Valuation cue words.
const OVERVALUED_WORDS    = ["overvalued", "expensive", "overpriced", "too costly", "stretched", "frothy", "rich multiple"];
const UNDERVALUED_WORDS   = ["undervalued", "cheap", "bargain", "discount", "compelling value", "trading below"];
const FAIRLY_VALUED_WORDS = ["fairly valued", "fair value", "in line", "reasonable price"];

// Recurring themes in the rare earth space. Match a phrase → tag.
const THEME_RULES = [
  { tag: "supply_chain",          re: /supply chain|sourcing|onshoring|reshoring/i },
  { tag: "china_export_controls", re: /china.{0,30}export|export control|beijing/i },
  { tag: "ev_demand",             re: /\bEV\b|electric vehicle|battery demand/i },
  { tag: "defense",               re: /defense|military|pentagon|DoD/i },
  { tag: "regulation",            re: /regulat|policy|legislation|tariff|subsidy/i },
  { tag: "pricing",               re: /price|pricing|spot market|NdPr/i },
  { tag: "magnets",               re: /magnet|NdFeB|permanent magnet/i },
  { tag: "production",            re: /production|output|mining capacity|throughput/i },
  { tag: "earnings",              re: /earnings|quarterly results|Q[1-4]\s?20\d{2}/i },
];

// Count how many words from `list` appear in `text` (case-insensitive,
// whole-word-ish). Multi-word entries are matched as substrings.
function countMatches(text, list) {
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of list) {
    const needle = w.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(needle, idx)) !== -1) { n++; idx += needle.length; }
  }
  return n;
}

export function analyzeSentiment(text) {
  const bull = countMatches(text, BULLISH_WORDS);
  const bear = countMatches(text, BEARISH_WORDS);
  if (bull === 0 && bear === 0) return "neutral";
  if (bull >= bear * 2) return "bullish";
  if (bear >= bull * 2) return "bearish";
  return "neutral";
}

export function analyzeValuation(text) {
  const over  = countMatches(text, OVERVALUED_WORDS);
  const under = countMatches(text, UNDERVALUED_WORDS);
  const fair  = countMatches(text, FAIRLY_VALUED_WORDS);
  if (over === 0 && under === 0 && fair === 0) return "fairly_valued";
  if (under > over && under >= fair) return "undervalued";
  if (over > under && over >= fair) return "overvalued";
  return "fairly_valued";
}

export function extractThemes(text) {
  const tags = [];
  for (const rule of THEME_RULES) if (rule.re.test(text)) tags.push(rule.tag);
  return tags;
}

// Find all directory companies mentioned in the text. For each, pull out the
// surrounding paragraph and run the sentiment/valuation/theme heuristics on
// that local window — so a bullish line about MP doesn't bleed into Lynas.
export function extractCompanies(text) {
  const found = [];
  for (const entry of COMPANY_DIRECTORY) {
    if (!entry.pattern.test(text)) continue;
    const window = localContext(text, entry.pattern);
    found.push({
      name: entry.name,
      ticker: entry.ticker,
      sentiment: analyzeSentiment(window),
      valuation: analyzeValuation(window),
      themes: extractThemes(window),
    });
  }
  return found;
}

// Grab roughly ±400 chars around the first match, snapping to paragraph breaks
// when we can. Good enough to isolate one company's discussion from another's.
function localContext(text, pattern) {
  const m = text.match(pattern);
  if (!m) return text;
  const idx = text.indexOf(m[0]);
  const start = Math.max(0, idx - 400);
  const end = Math.min(text.length, idx + 400);
  return text.slice(start, end);
}
