import { Router, Request, Response } from "express";
import { ergast } from "../services/ergast";
import { cacheMiddleware } from "../middleware/cache";

const router = Router();

// Apply 5-minute cache to all GET routes
router.use(cacheMiddleware(300));

// ─── GET /api/drivers/:year ───────────────────────────────────────────────────
// Returns all drivers for a season

router.get("/:year", async (req: Request, res: Response): Promise<void> => {
  const year = parseInt(req.params.year as string, 10);

  if (isNaN(year)) {
    res.status(400).json({ error: "Invalid year" });
    return;
  }

  try {
    const drivers = await ergast.drivers(year);
    res.json({ year, drivers });
  } catch (err) {
    console.error("[drivers] GET /:year error:", err);
    res.status(502).json({ error: "Failed to fetch drivers" });
  }
});

// ─── GET /api/standings/drivers/:year ────────────────────────────────────────
// Returns driver championship standings

router.get(
  "/standings/:year",
  async (req: Request, res: Response): Promise<void> => {
    const year = parseInt(req.params.year as string, 10);

    if (isNaN(year)) {
      res.status(400).json({ error: "Invalid year" });
      return;
    }

    try {
      const standings = await ergast.driverStandings(year);
      res.json({ year, standings });
    } catch (err) {
      console.error("[drivers] GET /standings/:year error:", err);
      res.status(502).json({ error: "Failed to fetch driver standings" });
    }
  },
);

// ─── GET /api/standings/constructors/:year ────────────────────────────────────
// Returns constructor championship standings (mounted at /api/standings)

router.get(
  "/constructors/:year",
  async (req: Request, res: Response): Promise<void> => {
    const year = parseInt(req.params.year as string, 10);

    if (isNaN(year)) {
      res.status(400).json({ error: "Invalid year" });
      return;
    }

    try {
      const standings = await ergast.constructorStandings(year);
      res.json({ year, standings });
    } catch (err) {
      console.error("[standings] GET /constructors/:year error:", err);
      res.status(502).json({ error: "Failed to fetch constructor standings" });
    }
  },
);

export default router;
