import { Router, Request, Response } from "express";
import { openf1 } from "../services/openf1";
import { ergast } from "../services/ergast";
import { cacheMiddleware } from "../middleware/cache";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// Apply 5-minute cache to all GET routes in this router
router.use(cacheMiddleware(300));

// ─── GET /api/races/:year ─────────────────────────────────────────────────────
// Returns the full season schedule plus OpenF1 session metadata

router.get("/:year", async (req: Request, res: Response): Promise<void> => {
  const year = parseInt(req.params.year as string, 10);

  if (isNaN(year) || year < 1950 || year > 2030) {
    res.status(400).json({ error: "Invalid year" });
    return;
  }

  try {
    const [schedule, sessions, meetings] = await Promise.all([
      ergast.schedule(year),
      openf1.raceSessions(year).catch(() => []),
      openf1.meetings(year).catch(() => []),
    ]);

    res.json({ year, schedule, sessions, meetings });
  } catch (err) {
    console.error("[races] GET /:year error:", err);
    res.status(502).json({ error: "Failed to fetch race schedule" });
  }
});

// ─── GET /api/race/:year/:round/results ──────────────────────────────────────
// Returns race results, optionally with DB cache for historical rounds

router.get(
  "/:year/:round/results",
  async (req: Request, res: Response): Promise<void> => {
    const year = parseInt(req.params.year as string, 10);
    const round = parseInt(req.params.round as string, 10);

    if (isNaN(year) || isNaN(round)) {
      res.status(400).json({ error: "Invalid year or round" });
      return;
    }

    // For past races, check DB cache first
    const isHistorical = year < new Date().getFullYear();
    if (isHistorical) {
      try {
        const cached = await prisma.cachedRaceResult.findUnique({
          where: { year_round: { year, round } },
        });
        if (cached) {
          return void res.json({ year, round, source: "db_cache", ...cached.data as object });
        }
      } catch (dbErr) {
        console.warn("[races] DB cache lookup failed:", dbErr);
      }
    }

    try {
      const races = await ergast.raceResults(year, round);

      // Persist historical results to DB for faster future lookups
      if (isHistorical && races.length > 0) {
        // Cast to unknown first to satisfy Prisma's InputJsonValue constraint
        const jsonData = { races } as unknown as import("@prisma/client").Prisma.InputJsonValue;
        await prisma.cachedRaceResult
          .upsert({
            where: { year_round: { year, round } },
            update: { data: jsonData, cachedAt: new Date() },
            create: { year, round, data: jsonData },
          })
          .catch((e) => console.warn("[races] DB upsert failed:", e));
      }

      res.json({ year, round, races });
    } catch (err) {
      console.error("[races] GET /:year/:round/results error:", err);
      res.status(502).json({ error: "Failed to fetch race results" });
    }
  },
);

// ─── GET /api/race/:year/:round/laps ─────────────────────────────────────────
// Returns lap time data from Ergast for a specific race

router.get(
  "/:year/:round/laps",
  async (req: Request, res: Response): Promise<void> => {
    const year = parseInt(req.params.year as string, 10);
    const round = parseInt(req.params.round as string, 10);

    if (isNaN(year) || isNaN(round)) {
      res.status(400).json({ error: "Invalid year or round" });
      return;
    }

    try {
      const races = await ergast.lapTimes(year, round);
      res.json({ year, round, races });
    } catch (err) {
      console.error("[races] GET /:year/:round/laps error:", err);
      res.status(502).json({ error: "Failed to fetch lap times" });
    }
  },
);

export default router;
