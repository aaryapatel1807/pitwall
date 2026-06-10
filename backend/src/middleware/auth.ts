import { Request, Response, NextFunction } from "express";
import { verifyToken } from "@clerk/backend";

// Extend Express Request to carry the verified Clerk userId
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
      };
    }
  }
}

/**
 * Clerk JWT middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it with the Clerk backend SDK, and attaches
 * `req.auth.userId` for downstream route handlers.
 *
 * Returns 401 on missing/invalid token.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("[auth] CLERK_SECRET_KEY is not set");
    res.status(500).json({ error: "Auth service not configured" });
    return;
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    req.auth = {
      userId: payload.sub,
      sessionId: (payload.sid as string) ?? "",
    };
    next();
  } catch (err) {
    console.error("[auth] token verification failed", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
