// server.js — tiny Express wrapper exposing the agent as POST /analyze.

import "dotenv/config";
import express from "express";
import { runAgent } from "./agent.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/analyze", async (req, res) => {
  const query =
    typeof req.body?.query === "string" && req.body.query.trim().length > 0
      ? req.body.query
      : "What is the current sentiment around rare earth mining companies on Seeking Alpha?";

  try {
    const result = await runAgent(query);
    res.json(result);
  } catch (err) {
    // Surface enough detail to debug while learning, but don't leak the key.
    console.error("[server] /analyze failed:", err);
    const status = err?.status || err?.statusCode || 500;
    res.status(status).json({
      error: err?.message || "agent failed",
      type: err?.name || "Error",
    });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[server] WARNING: ANTHROPIC_API_KEY is not set; /analyze will fail.");
  }
  console.log(`[server] listening on http://localhost:${PORT}`);
});
