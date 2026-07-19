import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger";
import { ensureRedis, redisClient } from "./redis";
import { CHANNELS } from "@workspace/common";

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function attachWebSocket(server: Server): void {
  if (wss) return;
  wss = new WebSocketServer({ server, path: "/api/ws" });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ channel: "system", payload: { connected: true } }));
    ws.on("close", () => clients.delete(ws));
    ws.on("error", (err) => logger.error({ err }, "WebSocket client error"));
  });

  // Subscribe to Redis channels and fan-out to dashboard clients
  ensureRedis()
    .then(async () => {
      const subscriber = redisClient.duplicate();
      await subscriber.connect();
      for (const channel of Object.values(CHANNELS)) {
        await subscriber.subscribe(channel, (message) => {
          broadcast(channel, message);
        });
      }
    })
    .catch((err) => logger.error({ err }, "WebSocket Redis setup failed"));
}

function broadcast(channel: string, message: string): void {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}
