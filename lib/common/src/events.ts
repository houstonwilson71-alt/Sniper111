/**
 * Event-bus contract for the sniper services.
 * The backend publishes these events to Redis Pub/Sub or NATS.
 * Services subscribe by channel and JSON payload shape.
 */

export const CHANNELS = {
  /** New token detected by a listener */
  TOKEN_DETECTED: "sniper.token.detected",
  /** Token passed or failed safety filters */
  TOKEN_FILTERED: "sniper.token.filtered",
  /** Buy signal emitted by backend */
  BUY_SIGNAL: "sniper.signal.buy",
  /** Sell signal emitted by backend */
  SELL_SIGNAL: "sniper.signal.sell",
  /** Trade execution update from executor */
  TRADE_UPDATE: "sniper.trade.update",
  /** Position update from executor/backend */
  POSITION_UPDATE: "sniper.position.update",
  /** Price update for positions */
  PRICE_UPDATE: "sniper.price.update",
  /** Bot state change */
  BOT_STATE: "sniper.bot.state",
  /** Emergency stop */
  EMERGENCY_STOP: "sniper.emergency.stop",
  /** Dashboard live feed */
  DASHBOARD_FEED: "sniper.dashboard.feed",
} as const;

export interface BaseEvent<T = unknown> {
  channel: string;
  id: string;
  timestamp: string;
  payload: T;
}

export interface TokenDetectedEvent {
  channel: typeof CHANNELS.TOKEN_DETECTED;
  token: import("./types.js").Token;
}

export interface TokenFilteredEvent {
  channel: typeof CHANNELS.TOKEN_FILTERED;
  tokenId: string;
  passed: boolean;
  reasons: string[];
}

export interface BuySignalEvent {
  channel: typeof CHANNELS.BUY_SIGNAL;
  signal: import("./types.js").BuySignal;
}

export interface SellSignalEvent {
  channel: typeof CHANNELS.SELL_SIGNAL;
  signal: import("./types.js").SellSignal;
}

export interface TradeUpdateEvent {
  channel: typeof CHANNELS.TRADE_UPDATE;
  trade: import("./types.js").Trade;
}

export interface PositionUpdateEvent {
  channel: typeof CHANNELS.POSITION_UPDATE;
  position: import("./types.js").Position;
}

export interface PriceUpdateEvent {
  channel: typeof CHANNELS.PRICE_UPDATE;
  tokenId: string;
  priceUsd: number;
}

export interface BotStateEvent {
  channel: typeof CHANNELS.BOT_STATE;
  state: import("./types.js").BotState;
}

export interface EmergencyStopEvent {
  channel: typeof CHANNELS.EMERGENCY_STOP;
  reason: string;
  stoppedAt: string;
}

export type SniperEvent =
  | TokenDetectedEvent
  | TokenFilteredEvent
  | BuySignalEvent
  | SellSignalEvent
  | TradeUpdateEvent
  | PositionUpdateEvent
  | PriceUpdateEvent
  | BotStateEvent
  | EmergencyStopEvent;

export function makeEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
