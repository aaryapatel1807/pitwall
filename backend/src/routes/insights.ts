import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { askGemini, type GeminiMessage } from "../services/gemini";
import { z } from "zod";

const router = Router();

// ─── Validation ───────────────────────────────────────────────────────────────

const AskSchema = z.object({
  question: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
});

// ─── POST /api/insights/ask (protected) ──────────────────────────────────────
// Sends a question to Gemini and returns the AI response.
// Accepts optional conversation history for multi-turn Q&A.

router.post(
  "/ask",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = AskSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { question, history } = parsed.data;

    try {
      const answer = await askGemini(question, history as GeminiMessage[]);

      res.json({
        answer,
        question,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[insights] Gemini error:", err);

      if (message.includes("API key")) {
        res.status(503).json({ error: "AI service is not configured" });
      } else {
        res.status(502).json({ error: "Failed to get AI response", detail: message });
      }
    }
  },
);

export default router;
