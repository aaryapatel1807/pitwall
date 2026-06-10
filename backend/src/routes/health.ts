import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /health
 * Basic liveness check — always 200.
 * Also tests DB connectivity for a more complete status report.
 */
router.get("/", async (_req: Request, res: Response) => {
  const status: {
    status: "ok" | "degraded";
    uptime: number;
    timestamp: string;
    db: "connected" | "disconnected";
    version: string;
  } = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: "disconnected",
    version: process.env.npm_package_version ?? "1.0.0",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    status.db = "connected";
  } catch {
    status.status = "degraded";
    status.db = "disconnected";
  }

  res.status(200).json(status);
});

export default router;
