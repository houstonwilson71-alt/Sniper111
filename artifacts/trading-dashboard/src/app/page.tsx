"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsd, formatPct } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, BarChart3, Wallet, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { type EquityPoint } from "@workspace/common";
import { getWsUrl } from "@/lib/api";

export default function Dashboard() {
  const { data: perf } = useQuery({ queryKey: ["performance"], queryFn: api.getPerformance });
  const { data: equity } = useQuery({ queryKey: ["equity"], queryFn: api.getEquity });
  const { data: status } = useQuery({ queryKey: ["bot-status"], queryFn: api.getBotStatus });
  const [liveEvents, setLiveEvents] = useState<{ channel: string; payload: unknown }[]>([]);

  useEffect(() => {
    const url = getWsUrl();
    if (!url) return;
    const ws = new WebSocket(url);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setLiveEvents((prev) => [data, ...prev].slice(0, 20));
    };
    return () => ws.close();
  }, []);

  const summary = perf?.summary;
  const points: EquityPoint[] = equity?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-zinc-400">Real-time overview of the sniper bot.</p>
        </div>
        <div className="flex items-center gap-2">
          {status?.liveTradingEnabled ? (
            <Badge variant="danger">LIVE TRADING</Badge>
          ) : (
            <Badge variant="warning">PAPER / SAFETY</Badge>
          )}
          {status?.emergencyStopped && <Badge variant="danger">EMERGENCY STOP</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total P&L</CardDescription>
            <CardTitle className={summary && summary.totalPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
              {summary ? formatUsd(summary.totalPnlUsd) : "$0.00"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle>{summary ? `${summary.winRate.toFixed(1)}%` : "0.0%"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Activity className="h-4 w-4 text-zinc-400" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Positions</CardDescription>
            <CardTitle>{summary ? summary.openPositions : 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Wallet className="h-4 w-4 text-zinc-400" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Trades</CardDescription>
            <CardTitle>{summary ? summary.totalTrades : 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart3 className="h-4 w-4 text-zinc-400" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equity Curve</CardTitle>
          <CardDescription>7-day portfolio value</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => new Date(ts).toLocaleDateString()}
                  stroke="#52525b"
                />
                <YAxis stroke="#52525b" tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(v: number) => formatUsd(v)}
                />
                <Area
                  type="monotone"
                  dataKey="equityUsd"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorEquity)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Event Stream</CardTitle>
          <CardDescription>Recent events from the event bus</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto space-y-2 text-sm font-mono">
            {liveEvents.length === 0 && (
              <p className="text-zinc-500">Waiting for events...</p>
            )}
            {liveEvents.map((e, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-zinc-800 pb-2">
                <Badge variant="outline">{e.channel}</Badge>
                <span className="text-zinc-400 truncate">{JSON.stringify(e.payload).slice(0, 80)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
