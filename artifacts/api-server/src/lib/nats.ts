import { connect, type NatsConnection, JSONCodec } from "nats";
import { logger } from "./logger";
import { CHANNELS } from "@workspace/common";

let natsConn: NatsConnection | null = null;
const codec = JSONCodec();

export async function ensureNats(): Promise<NatsConnection | null> {
  const url = process.env.NATS_URL;
  if (!url) return null;
  if (natsConn && !natsConn.isClosed()) return natsConn;
  try {
    natsConn = await connect({ servers: url });
    logger.info("NATS connected");
    return natsConn;
  } catch (err) {
    logger.warn({ err }, "NATS not available");
    return null;
  }
}

export async function publishNatsEvent(channel: keyof typeof CHANNELS, payload: unknown): Promise<boolean> {
  const conn = await ensureNats();
  if (!conn) return false;
  try {
    await conn.publish(CHANNELS[channel], codec.encode(payload));
    return true;
  } catch (err) {
    logger.error({ err }, "NATS publish failed");
    return false;
  }
}

export async function subscribeNats(handler: (channel: string, payload: unknown) => void): Promise<void> {
  const conn = await ensureNats();
  if (!conn) return;
  const sub = conn.subscribe("*");
  (async () => {
    for await (const msg of sub) {
      try {
        const data = codec.decode(msg.data) as unknown;
        handler(msg.subject, data);
      } catch (err) {
        logger.error({ err }, "NATS decode error");
      }
    }
  })();
}
