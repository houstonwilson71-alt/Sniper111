---
name: Redis as optional event bus
description: Redis is not available in the Replit container; treat it as optional and suppress reconnect storms.
---

The Replit container does not run Redis. The application should keep working when Redis is missing, using HTTP polling for the frontend and graceful degradation for the backend.

**Rule:** Configure the Redis client to stop reconnecting after a few attempts, and log the unavailability once instead of on every reconnect attempt.

**Why:** Without this, the API logs are flooded with `ECONNREFUSED 127.0.0.1:6379` errors and the container log quota is consumed quickly.

**How to apply:**
- In `redis.createClient`, set `socket.reconnectStrategy` to return `false` after 2 retries.
- On `error`, only log non-ECONNREFUSED errors.
- In `ensureRedis()`, catch the connection failure and return `false` so callers can skip Redis-dependent features.

