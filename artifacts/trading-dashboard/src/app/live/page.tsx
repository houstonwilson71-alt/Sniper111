"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Token } from "@workspace/common";

export default function LivePage() {
  const { data, isLoading } = useQuery({ queryKey: ["tokens"], queryFn: api.getTokens, refetchInterval: 2000 });

  const items: Token[] = data?.items || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live Scanner</h1>
        <p className="text-zinc-400">New pools/pairs detected across Solana and BSC.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detected Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="pb-2">Chain</th>
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Liquidity</th>
                  <th className="pb-2">Age</th>
                  <th className="pb-2">Holders</th>
                  <th className="pb-2">Top 10%</th>
                  <th className="pb-2">Rug Score</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {isLoading && (
                  <tr><td colSpan={8} className="py-4 text-zinc-500">Loading...</td></tr>
                )}
                {items.map((token) => (
                  <tr key={token.id} className="hover:bg-zinc-900/50">
                    <td className="py-3">
                      <Badge variant={token.chain === "solana" ? "outline" : "warning"}>{token.chain}</Badge>
                    </td>
                    <td className="py-3 font-medium">{token.symbol}</td>
                    <td className="py-3">${token.liquidityUsd.toLocaleString()}</td>
                    <td className="py-3">{token.ageSeconds}s</td>
                    <td className="py-3">{token.holders}</td>
                    <td className="py-3">{token.top10Pct.toFixed(1)}%</td>
                    <td className="py-3">{token.rugScore.toFixed(1)}</td>
                    <td className="py-3">
                      {token.filterPassed ? (
                        <Badge variant="success">PASS</Badge>
                      ) : (
                        <Badge variant="danger">FAIL</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
