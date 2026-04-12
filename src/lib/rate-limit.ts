// In-memory rate limiter (per-process, resets on deploy)
// For production at scale, use Redis or Upstash Rate Limit

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  /** Unique namespace (e.g. "login", "register", "api") */
  prefix: string;
  /** Max requests in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (IP or user ID)
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const fullKey = `${options.prefix}:${key}`;
  const now = Date.now();
  const entry = store.get(fullKey);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(fullKey, { count: 1, resetAt: now + options.windowSeconds * 1000 });
    return { allowed: true, remaining: options.limit - 1, resetAt: now + options.windowSeconds * 1000 };
  }

  if (entry.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: options.limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// Preset configurations
export const RATE_LIMITS = {
  /** Login: 5 attempts per 15 minutes */
  login: { prefix: "login", limit: 5, windowSeconds: 15 * 60 },
  /** Register: 3 attempts per hour */
  register: { prefix: "register", limit: 3, windowSeconds: 60 * 60 },
  /** API write: 30 requests per minute */
  apiWrite: { prefix: "api-write", limit: 30, windowSeconds: 60 },
  /** API read: 60 requests per minute */
  apiRead: { prefix: "api-read", limit: 60, windowSeconds: 60 },
  /** Telegram link: 5 per hour */
  telegramLink: { prefix: "tg-link", limit: 5, windowSeconds: 60 * 60 },
} as const;
