---
name: Replit WebSocket routing
description: How the Replit path proxy affects WebSocket paths and how to keep frontend/backend paths aligned.
---

In Replit, the API artifact is mounted under a path prefix (e.g., `/api`). The backend Express server sees requests at that prefix, so the WebSocket upgrade path must match the public path.

**Rule:** If the backend is mounted at `/api`, the WebSocket server should accept `/api/ws`, or the frontend should connect to `/api/ws` and the backend should not filter by a strict `/ws` path.

**Why:** The proxy preserves the artifact preview path when forwarding to the backend. A backend `WebSocketServer({ path: "/ws" })` will reject an upgrade from `/api/ws` because the paths don't match.

**How to apply:**
- Backend: set `WebSocketServer({ path: "/api/ws" })` or omit `path` to accept any upgrade.
- Frontend: derive the URL from `window.location` with protocol `ws:`/`wss:` and path `/api/ws`, or use `NEXT_PUBLIC_WS_URL` for local development.

