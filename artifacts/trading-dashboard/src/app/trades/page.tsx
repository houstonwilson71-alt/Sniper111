"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsd, formatPct, truncate } from "@/lib/utils";
import { type Trade } from "@workspace/common";
import { useState } from "react";

export default function TradesPage() {
  const { data } = useQuery({ queryKey: ["trades"], queryFn: api.getTrades, refetchInterval: 5000 });
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");
  const items: Trade[] = (data?.items || []).filter((t) => (filter === "all" ? true : t.side === filter));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trade Log</h1>
          <p className="text-zinc-400">All executed buys and sells.</p>
        </div>
        <div className="flex gap-2">
          {(["all", "buy", "sell"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-sm capitalize ${filter === f ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="pb-2">Time</th>
                <th className="pb-2">Token</th>
                <th className="pb-2">Chain</th>
                <th className="pb-2">Side</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Price</th>
                <th className="pb-2">P&L</th>
                <th className="pb-2">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-zinc-500">No trades</td></tr>
              )}
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-900/50">
                  <td className="py-3">{new Date(t.executedAt).toLocaleTimeString()}</td>
                  <td className="py-3 font-medium">{t.tokenSymbol}</td>
                  <td className="py-3"><Badge variant={t.chain === "solana" ? "outline" : "warning"}>{t.chain}</Badge></td>
                  <td className="py-3">
                    <Badge variant={t.side === "buy" ? "success" : "danger"}>{t.side.toUpperCase()}</Badge>
                  </td>
                  <td className="py-3">{formatUsd(t.amountUsd)}</td>
                  <td className="py-3">{t.priceUsd.toExponential(4)}</td>
                  <td className={t.pnlUsd && t.pnlUsd >= 0 ? "py-3 text-emerald-400" : "py-3 text-red-400"}>
                    {t.pnlUsd ? `${formatUsd(t.pnlUsd)} (${formatPct((t.pnlPct || 0) * 100)})` : "—"}
                  </td>
                  <td className="py-3 font-mono text-xs">{truncate(t.txHash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
