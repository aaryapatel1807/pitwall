import NodeCache from "node-cache";

// Global cache instance — 5 min TTL, check expiry every 60s
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Get a value from cache.
 * Returns undefined on miss.
 */
export function cacheGet<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

/**
 * Set a value in cache with optional custom TTL (seconds).
 * Defaults to the global 5-minute TTL.
 */
export function cacheSet<T>(key: string, value: T, ttl?: number): void {
  if (ttl !== undefined) {
    cache.set(key, value, ttl);
  } else {
    cache.set(key, value);
  }
}

/**
 * Delete a single key from cache.
 */
export function cacheDel(key: string): void {
  cache.del(key);
}

/**
 * Flush the entire cache.
 */
export function cacheFlush(): void {
  cache.flushAll();
}

/**
 * Express middleware that caches responses by URL.
 * Skip caching for non-GET requests automatically.
 */
export function cacheMiddleware(ttl?: number) {
  return (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    if (req.method !== "GET") return next();

    const key = `express:${req.originalUrl}`;
    const cached = cacheGet<string>(key);

    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Content-Type", "application/json");
      return res.send(cached);
    }

    // Monkey-patch res.json to intercept and cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      try {
        const serialised = JSON.stringify(body);
        cacheSet(key, serialised, ttl);
        res.setHeader("X-Cache", "MISS");
      } catch {
        // ignore serialisation errors
      }
      return originalJson(body);
    };

    next();
  };
}

export default cache;
