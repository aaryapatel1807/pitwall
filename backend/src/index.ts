import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import healthRouter from "./routes/health";
import racesRouter from "./routes/races";
import driversRouter from "./routes/drivers";
import strategyRouter from "./routes/strategy";
import insightsRouter from "./routes/insights";

const app = express();

// ─── Security & logging ───────────────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:8080",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check (no /api prefix — useful for load balancer pings)
app.use("/health", healthRouter);

// Race data — GET /api/races/:year, GET /api/race/:year/:round/results, GET /api/race/:year/:round/laps
app.use("/api/races", racesRouter);
app.use("/api/race", racesRouter);

// Driver & constructor standings
// GET /api/drivers/:year
// GET /api/standings/drivers/:year  → driversRouter handles /standings/:year
// GET /api/standings/constructors/:year → driversRouter handles /constructors/:year
app.use("/api/drivers", driversRouter);
app.use("/api/standings", driversRouter);

// Strategy simulator + saved strategies (all protected)
// POST /api/strategy/simulate
// POST /api/strategy/save
// GET  /api/strategy/saved
app.use("/api/strategy", strategyRouter);

// AI insights (protected)
// POST /api/insights/ask
app.use("/api/insights", insightsRouter);

// ─── 404 handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[app] unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
