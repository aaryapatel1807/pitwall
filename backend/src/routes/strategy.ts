import { Router, Request, Response } from "express";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();
const prisma = new PrismaClient();

// ─── Validation schemas ───────────────────────────────────────────────────────

const SimStintSchema = z.object({
  compound: z.enum(["SOFT", "MEDIUM", "HARD", "INTER", "WET"]),
  lapStart: z.number().int().positive(),
  lapEnd: z.number().int().positive(),
});

const SimRequestSchema = z.object({
  year: z.number().int().min(1950).max(2030),
  round: z.number().int().positive(),
  driverId: z.string().min(1).max(100),
  stints: z.array(SimStintSchema).min(1).max(10),
});

const SaveStrategySchema = z.object({
  raceName: z.string().min(1).max(200),
  driverId: z.string().min(1).max(100),
  stints: z.array(SimStintSchema).min(1).max(10),
  predictedPosition: z.number().int().min(1).max(20),
  timeDelta: z.string().min(1).max(50),
});

// ─── POST /api/strategy/simulate (protected) ──────────────────────────────────
// Proxies to FastAPI; falls back to a server-side mock if FastAPI is down

router.post(
  "/simulate",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = SimRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const fastapiUrl = process.env.FASTAPI_URL;

    if (fastapiUrl) {
      try {
        const response = await axios.post(`${fastapiUrl}/simulate`, parsed.data, {
          timeout: 15_000,
          headers: { "Content-Type": "application/json" },
        });
        res.json({ ...response.data, demo: false });
        return;
      } catch (err) {
        console.warn("[strategy] FastAPI unavailable, falling back to mock:", err);
      }
    }

    // Server-side deterministic mock (mirrors the frontend fallback)
    const result = runMockSim(parsed.data);
    res.json(result);
  },
);

// ─── POST /api/strategy/save (protected) ─────────────────────────────────────
// Saves a strategy to the database, linked to the authenticated user

router.post(
  "/save",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = SaveStrategySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const clerkId = req.auth!.userId;

    try {
      // Upsert the user record by clerkId
      const user = await prisma.user.upsert({
        where: { clerkId },
        update: {},
        create: {
          clerkId,
          email: "", // email enrichment happens via Clerk webhook
        },
      });

      const strategy = await prisma.savedStrategy.create({
        data: {
          userId: user.id,
          raceName: parsed.data.raceName,
          driverId: parsed.data.driverId,
          stints: parsed.data.stints,
          predictedPosition: parsed.data.predictedPosition,
          timeDelta: parsed.data.timeDelta,
        },
      });

      res.status(201).json({ strategy });
    } catch (err) {
      console.error("[strategy] save error:", err);
      res.status(500).json({ error: "Failed to save strategy" });
    }
  },
);

// ─── GET /api/strategy/saved (protected) ─────────────────────────────────────
// Returns all saved strategies for the authenticated user

router.get(
  "/saved",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const clerkId = req.auth!.userId;

    try {
      const user = await prisma.user.findUnique({ where: { clerkId } });
      if (!user) {
        res.json({ strategies: [] });
        return;
      }

      const strategies = await prisma.savedStrategy.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });

      res.json({ strategies });
    } catch (err) {
      console.error("[strategy] fetch saved error:", err);
      res.status(500).json({ error: "Failed to fetch saved strategies" });
    }
  },
);

export default router;

// ─── Server-side mock simulation ─────────────────────────────────────────────

const BASE_CONFIG: Record<string, { start: number; deg: number }> = {
  SOFT: { start: 74.2, deg: 0.08 },
  MEDIUM: { start: 74.8, deg: 0.05 },
  HARD: { start: 75.4, deg: 0.03 },
  INTER: { start: 78.5, deg: 0.06 },
  WET: { start: 82.0, deg: 0.05 },
};
const PIT_COST = 22;

interface SimStint {
  compound: string;
  lapStart: number;
  lapEnd: number;
}

interface SimRequest {
  year: number;
  round: number;
  driverId: string;
  stints: SimStint[];
}

function totalToString(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

function runMockSim(req: SimRequest) {
  const lapTimes: number[] = [];
  const degradationCurve: { lap: number; time: number; compound: string }[] = [];
  let total = 0;

  req.stints.forEach((st, i) => {
    if (i > 0) total += PIT_COST;
    const cfg = BASE_CONFIG[st.compound] ?? BASE_CONFIG.MEDIUM;
    for (let lap = st.lapStart; lap <= st.lapEnd; lap++) {
      const t = parseFloat((cfg.start + (lap - st.lapStart) * cfg.deg).toFixed(3));
      lapTimes.push(t);
      degradationCurve.push({ lap, time: t, compound: st.compound });
      total += t;
    }
  });

  const totalLaps = lapTimes.length;
  const actualStrategy = [
    { compound: "MEDIUM", lapStart: 1, lapEnd: Math.round(totalLaps * 0.45) },
    {
      compound: "HARD",
      lapStart: Math.round(totalLaps * 0.45) + 1,
      lapEnd: totalLaps,
    },
  ];

  let actualTotal = PIT_COST;
  actualStrategy.forEach((st) => {
    const cfg = BASE_CONFIG[st.compound];
    for (let lap = st.lapStart; lap <= st.lapEnd; lap++) {
      actualTotal += cfg.start + (lap - st.lapStart) * cfg.deg;
    }
  });

  const delta = total - actualTotal;
  const predictedPosition = Math.max(1, Math.min(20, Math.round(3 + delta / 8)));

  return {
    predictedPosition,
    totalRaceTime: totalToString(total),
    timeDeltaVsActual: `${delta >= 0 ? "+" : "-"}${Math.abs(delta).toFixed(3)}`,
    lapTimes,
    degradationCurve,
    actualStrategy,
    actualPosition: 3,
    demo: true,
  };
}
