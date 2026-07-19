"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatUsd, formatPct } from "@/lib/utils";
import { type Position } from "@workspace/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PositionsPage() {
  const { data } = useQuery({ queryKey: ["positions"], queryFn: api.getPositions, refetchInterval: 5000 });
  const items: Position[] = data?.items || [];
  const open = items.filter((p) => p.status === "open");
  const closed = items.filter((p) => p.status === "closed");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Positions</h1>
        <p className="text-zinc-400">Open and closed trades with P&L.</p>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open ({open.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open">
          <PositionTable positions={open} />
        </TabsContent>
        <TabsContent value="closed">
          <PositionTable positions={closed} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PositionTable({ positions }: { positions: Position[] }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="pb-2">Token</th>
              <th className="pb-2">Chain</th>
              <th className="pb-2">Entry</th>
              <th className="pb-2">Current</th>
              <th className="pb-2">Size</th>
              <th className="pb-2">P&L</th>
              <th className="pb-2">TP1</th>
              <th className="pb-2">Trailing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {positions.length === 0 && (
              <tr><td colSpan={8} className="py-4 text-zinc-500">No positions</td></tr>
            )}
            {positions.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-900/50">
                <td className="py-3 font-medium">{p.tokenSymbol}</td>
                <td className="py-3"><Badge variant={p.chain === "solana" ? "outline" : "warning"}>{p.chain}</Badge></td>
                <td className="py-3">{p.entryPriceUsd.toExponential(4)}</td>
                <td className="py-3">{p.currentPriceUsd.toExponential(4)}</td>
                <td className="py-3">{formatUsd(p.sizeUsd)}</td>
                <td className={p.unrealisedPnlUsd >= 0 ? "py-3 text-emerald-400" : "py-3 text-red-400"}>
                  {formatUsd(p.unrealisedPnlUsd)} ({formatPct(p.unrealisedPnlPct * 100)})
                </td>
                <td className="py-3">{p.tp1Hit ? <Badge variant="success">HIT</Badge> : "—"}</td>
                <td className="py-3">{p.trailingStopActive ? <Badge variant="warning">ON</Badge> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
