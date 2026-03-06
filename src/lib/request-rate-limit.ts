import { Redis } from "@upstash/redis";

type LimitResult = {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
};

const memoryWindows = new Map<string, { count: number; resetAt: number }>();

let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function consumeRequestRateLimit(input: {
  namespace: string;
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<LimitResult> {
  const windowSeconds = Math.max(1, Math.floor(input.windowSeconds));
  if (!Number.isFinite(input.limit) || input.limit <= 0) {
    return { allowed: true, count: 0, retryAfterSeconds: 0 };
  }
  const fullKey = `${input.namespace}:${input.key}`;
  const client = getRedisClient();
  if (client) {
    const count = await client.incr(fullKey);
    if (count === 1) {
      await client.expire(fullKey, windowSeconds);
    }
    return {
      allowed: count <= input.limit,
      count,
      retryAfterSeconds: windowSeconds,
    };
  }

  const now = Date.now();
  const existing = memoryWindows.get(fullKey);
  if (!existing || existing.resetAt <= now) {
    memoryWindows.set(fullKey, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, count: 1, retryAfterSeconds: windowSeconds };
  }
  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= input.limit,
    count: existing.count,
    retryAfterSeconds,
  };
}
