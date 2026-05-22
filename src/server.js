// server.js — tiny Express wrapper exposing the agent as POST /analyze.

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Resolve .env.local relative to this file so it loads regardless of which
// directory `node` was launched from. .env.local wins over .env.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config();

import express from "express";
import rateLimit from "express-rate-limit";
import { runAgent } from "./agent.js";

const app = express();
app.use(express.json({ limit: "16kb" }));

// /analyze costs real Anthropic credits per call, so we require a shared
// secret on every request. The token lives in ANALYZE_TOKEN (see
// .env.local.example). Without it set, the endpoint refuses to serve.
const API_TOKEN = process.env.ANALYZE_TOKEN;

// Cap on raw user query length. Long inputs balloon token cost and give more
// room for prompt-injection payloads. 500 chars is plenty for a research query.
const MAX_QUERY_LEN = 500;

// Rate limit: a small number per minute per IP. Defence in depth in case the
// token leaks or you accidentally script a tight loop against your own server.
const analyzeLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});

function requireAuth(req, res, next) {
  if (!API_TOKEN) {
    return res.status(503).json({ error: "server not configured: ANALYZE_TOKEN missing" });
  }
  if (req.get("x-api-key") !== API_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/analyze", analyzeLimiter, requireAuth, async (req, res) => {
  const raw = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (raw.length > MAX_QUERY_LEN) {
    return res.status(400).json({ error: "query too long" });
  }
  const query =
    raw.length > 0
      ? raw
      : "What is the current sentiment around rare earth mining companies on Seeking Alpha?";

  try {
    const result = await runAgent(query);
    res.json(result);
  } catch (err) {
    // Log the full error server-side; return a generic message to the client
    // so we don't leak upstream status codes or SDK internals to callers.
    console.error("[server] /analyze failed:", err);
    res.status(500).json({ error: "agent failed" });
  }
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[server] WARNING: ANTHROPIC_API_KEY is not set; /analyze will fail.");
  }
  if (!API_TOKEN) {
    console.warn("[server] WARNING: ANALYZE_TOKEN is not set; /analyze will return 503.");
  }
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});
