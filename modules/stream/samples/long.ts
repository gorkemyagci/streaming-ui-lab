const F = "```";

export const long = `# Building a Rate Limiter for a Public API

Public APIs get abused. Sometimes it is a scraper, sometimes a buggy client stuck in a retry loop, and sometimes a legitimate customer who just had a very good day. A **rate limiter** protects your backend from all three without punishing normal traffic. This guide walks through the common algorithms, how to pick one, and how to ship it in a Node.js service backed by Redis.

## Why rate limit at all?

Before writing any code, be clear about what you are protecting:

1. **Availability** — one noisy client should not degrade latency for everyone else.
2. **Cost** — every request burns CPU, database connections and sometimes paid third-party calls.
3. **Fairness** — tiered plans only mean something if the limits are enforced.
4. **Security** — credential stuffing and enumeration attacks depend on high request volume.

A limiter is not a replacement for authentication, input validation or a WAF. It is one layer in a defense-in-depth setup.

## The four classic algorithms

### Fixed window

Count requests per key in a window aligned to the clock, for example \`12:00:00\` to \`12:00:59\`. When the count exceeds the limit, reject until the next window starts.

- Very cheap: one counter per key
- Easy to explain to customers
- Allows bursts of up to 2x the limit at window boundaries

### Sliding log

Store a timestamp for every request and count the ones inside the trailing window.

- Exact, no boundary bursts
- Memory grows with traffic, which is a problem at high volume

### Sliding window counter

Keep counters for the current and previous fixed windows, then weight the previous one by how much of it still overlaps the trailing window.

- Close to exact with only two counters
- The default choice for most HTTP APIs

### Token bucket

Each key owns a bucket that refills at a steady rate up to a maximum capacity. A request takes one token; an empty bucket means rejection.

- Allows controlled bursts up to the bucket size
- Natural fit for "N requests per second with bursts of M"
- Slightly more state: token count plus last refill time

## Comparing the options

| Algorithm | Memory per key | Burst handling | Accuracy | Typical use |
| --- | --- | --- | --- | --- |
| Fixed window | 1 counter | Up to 2x at edges | Low | Internal tools |
| Sliding log | 1 entry per request | None | Exact | Low-volume, high-value endpoints |
| Sliding window counter | 2 counters | Smoothed | High | Public REST APIs |
| Token bucket | 2 values | Configurable | High | Streaming, bursty clients |

For the rest of this guide we will implement a **sliding window counter**, then show a token bucket variant.

## Choosing the key

The key decides *who* shares a limit. Common choices:

- **API key or user ID** — the best option for authenticated traffic
  - Survives IP changes and NAT
  - Lets you attach per-plan limits
- **IP address** — the fallback for anonymous endpoints
  - Behind a proxy, read the client IP from a header you control
  - IPv6 users can rotate addresses inside a /64, so consider limiting by prefix
- **Route plus identity** — when some endpoints are much more expensive than others
  - For example, \`POST /exports\` might allow 5 per hour while \`GET /items\` allows 600 per minute

## Implementation in Node.js

We use Redis so that every instance behind the load balancer shares the same counters. The core logic runs in a Lua script so the read-modify-write happens atomically.

${F}ts
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

type LimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

const SCRIPT = \`
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
local previous = tonumber(redis.call("GET", KEYS[2]) or "0")
local weight = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local estimated = previous * weight + current

if estimated >= limit then
  return {0, 0}
end

redis.call("INCR", KEYS[1])
redis.call("PEXPIRE", KEYS[1], ARGV[3])
return {1, limit - estimated - 1}
\`;

export async function checkLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<LimitResult> {
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const elapsed = (now % windowMs) / windowMs;

  const [allowed, remaining] = (await redis.eval(SCRIPT, {
    keys: [\`rl:\${key}:\${window}\`, \`rl:\${key}:\${window - 1}\`],
    arguments: [String(1 - elapsed), String(limit), String(windowMs * 2)],
  })) as [number, number];

  return {
    allowed: allowed === 1,
    remaining: Math.max(0, Math.floor(remaining)),
    resetMs: windowMs - (now % windowMs),
  };
}
${F}

### Wiring it into the HTTP layer

The middleware below works with any framework that exposes a request and response object. It sets the standard headers so well-behaved clients can back off on their own.

${F}ts
import type { Request, Response, NextFunction } from "express";
import { checkLimit } from "./limiter";

export function rateLimit(limit: number, windowMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identity = req.user?.id ?? req.ip;
    const result = await checkLimit(identity, limit, windowMs);

    res.setHeader("RateLimit-Limit", limit);
    res.setHeader("RateLimit-Remaining", result.remaining);
    res.setHeader("RateLimit-Reset", Math.ceil(result.resetMs / 1000));

    if (!result.allowed) {
      res.setHeader("Retry-After", Math.ceil(result.resetMs / 1000));
      return res.status(429).json({ error: "rate_limited" });
    }

    next();
  };
}
${F}

## A token bucket variant

If your clients are bursty, a token bucket gives a better experience. The state is just two numbers per key.

~~~python
import time

class TokenBucket:
    def __init__(self, capacity: int, refill_per_sec: float):
        self.capacity = capacity
        self.refill_per_sec = refill_per_sec
        self.tokens = float(capacity)
        self.updated = time.monotonic()

    def take(self, cost: int = 1) -> bool:
        now = time.monotonic()
        elapsed = now - self.updated
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_sec)
        self.updated = now

        if self.tokens < cost:
            return False

        self.tokens -= cost
        return True
~~~

In production you would store \`tokens\` and \`updated\` in Redis and run the same arithmetic inside a Lua script, exactly like the sliding window example.

## Failure modes to plan for

> A rate limiter that takes your API down when Redis hiccups is worse than no rate limiter at all.

Decide up front what happens when the limiter itself is unavailable:

- **Fail open** — allow the request and log loudly. Right for most product APIs.
- **Fail closed** — reject the request. Right for login, password reset and payment endpoints.

Other things that bite teams in production:

1. Clock skew between instances when the window is computed from local time
2. Hot keys when one tenant generates most of the traffic
3. Forgetting to exempt health checks and internal service accounts
4. Returning \`500\` instead of \`429\`, which makes clients retry immediately

## Limits per plan

Most SaaS products tie limits to billing plans. Keep the numbers in configuration, not code:

| Plan | Requests / minute | Burst | Concurrent exports |
| --- | --- | --- | --- |
| Free | 60 | 10 | 1 |
| Pro | 600 | 100 | 3 |
| Enterprise | 6000 | 1000 | 10 |

Load the table at startup and look up the caller's plan once per request:

${F}json
{
  "free": { "perMinute": 60, "burst": 10, "exports": 1 },
  "pro": { "perMinute": 600, "burst": 100, "exports": 3 },
  "enterprise": { "perMinute": 6000, "burst": 1000, "exports": 10 }
}
${F}

## Testing the limiter

Unit tests cover the arithmetic; load tests prove the system holds up. A quick smoke test from the shell:

${F}bash
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code}\\n" \\
    -H "Authorization: Bearer $API_KEY" \\
    https://api.example.com/v1/items
done | sort | uniq -c
${F}

With a limit of 60 per minute you should see roughly sixty \`200\` responses and ten \`429\` responses.

## Checklist before launch

- [x] Limits defined per plan and per expensive route
- [x] \`RateLimit-*\` and \`Retry-After\` headers returned
- [x] Fail-open or fail-closed decided for every route
- [ ] Dashboards for rejected requests per key
- [ ] Alert when a single key exceeds 50% of total traffic
- [ ] Documentation page that tells customers how to handle \`429\`

## Observability

A limiter you cannot see is a limiter you cannot tune. Emit a metric for every decision, tagged with the route and the plan, but never with the raw key, because per-key tags explode cardinality in most metrics backends.

${F}ts
import { metrics } from "./telemetry";

export function recordDecision(route: string, plan: string, allowed: boolean) {
  metrics.increment("ratelimit.decisions", {
    route,
    plan,
    outcome: allowed ? "allowed" : "rejected",
  });
}
${F}

Useful views to build on top of this metric:

- Rejection rate per route over the last hour
- Top ten keys by rejected requests, from logs rather than metrics
- p99 latency of the limiter call itself, which should stay under 2 ms
  - If it creeps up, check Redis CPU and network round trips first
  - Pipelining or a local in-memory pre-check can halve the cost

When a customer complains about \`429\` responses, these views let you answer in minutes instead of digging through raw logs.

## Summary

Start with a **sliding window counter** keyed by API key, store it in Redis, run the update in a Lua script, and return clear headers. Add a token bucket where bursts matter, and decide explicitly how the limiter fails. Most of the hard problems are operational, not algorithmic, so invest in visibility from day one.
`;
