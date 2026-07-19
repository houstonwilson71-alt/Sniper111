import { useState } from 'react';
import { useListPositions } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatPct, formatShortDate } from '@/lib/utils';
import { LineChart, Target, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Positions() {
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const { data: positionsResponse, isLoading } = useListPositions(
    { status: activeTab }, 
    { query: { refetchInterval: 5000 } }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
          <LineChart className="h-8 w-8 text-primary" />
          Positions
        </h1>
        <p className="text-muted-foreground">Manage active holdings and review closed operations.</p>
      </div>

      <Tabs defaultValue="open" value={activeTab} onValueChange={(v) => setActiveTab(v as 'open' | 'closed')} className="w-full">
        <TabsList className="grid w-[400px] grid-cols-2 bg-muted/50">
          <TabsTrigger value="open" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Open Positions</TabsTrigger>
          <TabsTrigger value="closed" className="data-[state=active]:bg-card">Closed Archive</TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          <Card className="bg-card border-card-border">
            <CardHeader className="py-4 border-b bg-muted/20">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{activeTab === 'open' ? 'Active Deployments' : 'Settled Operations'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !positionsResponse || positionsResponse.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-muted-foreground text-center">
                  <Target className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium">No {activeTab} positions</p>
                  <p className="text-sm">The system is waiting for optimal entry parameters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-card">
                      <tr>
                        <th className="px-4 py-3 font-medium">Opened</th>
                        {activeTab === 'closed' && <th className="px-4 py-3 font-medium">Closed</th>}
                        <th className="px-4 py-3 font-medium">Token</th>
                        <th className="px-4 py-3 font-medium text-right">Size</th>
                        <th className="px-4 py-3 font-medium text-right">Entry</th>
                        <th className="px-4 py-3 font-medium text-right">Current</th>
                        <th className="px-4 py-3 font-medium text-right">Peak</th>
                        <th className="px-4 py-3 font-medium text-center">Milestones</th>
                        <th className="px-4 py-3 font-medium text-right">P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-t border-border font-mono text-sm">
                      {positionsResponse.map(position => {
                        const isProfit = position.unrealisedPnlUsd >= 0;
                        const pnlVal = activeTab === 'closed' && position.realisedPnlUsd !== undefined && position.realisedPnlUsd !== null 
                          ? position.realisedPnlUsd 
                          : position.unrealisedPnlUsd;
                        const pnlPctVal = activeTab === 'closed' 
                          ? (position.realisedPnlUsd! / position.sizeUsd) * 100
                          : position.unrealisedPnlPct;
                        const isPnlPositive = pnlVal >= 0;

                        return (
                          <tr key={position.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                              {formatShortDate(position.openedAt)}
                            </td>
                            {activeTab === 'closed' && (
                              <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                                {position.closedAt ? formatShortDate(position.closedAt) : '-'}
                              </td>
                            )}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground font-sans">{position.tokenSymbol}</span>
                                <Badge variant="outline" className={`text-[10px] h-4 px-1 py-0 font-sans ${position.chain === 'solana' ? 'text-purple-400 border-purple-500/30 bg-purple-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
                                  {position.chain === 'solana' ? 'SOL' : 'BSC'}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">{formatCurrency(position.sizeUsd)}</td>
                            <td className="px-4 py-4 text-right text-muted-foreground">{formatCurrency(position.entryPriceUsd)}</td>
                            <td className="px-4 py-4 text-right font-medium">{formatCurrency(position.currentPriceUsd)}</td>
                            <td className="px-4 py-4 text-right text-muted-foreground flex items-center justify-end gap-1">
                              <TrendingUp className="h-3 w-3 text-success opacity-70" />
                              {formatCurrency(position.peakPriceUsd)}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-1.5 font-sans">
                                <Badge variant="outline" className={`h-5 text-[10px] px-1.5 border-0 ${position.tp1Hit ? 'bg-success/20 text-success font-bold' : 'bg-muted text-muted-foreground'}`}>TP1</Badge>
                                <Badge variant="outline" className={`h-5 text-[10px] px-1.5 border-0 ${position.tp2Hit ? 'bg-success/20 text-success font-bold' : 'bg-muted text-muted-foreground'}`}>TP2</Badge>
                                <Badge variant="outline" className={`h-5 text-[10px] px-1.5 border-0 ${position.trailingStopActive ? 'bg-primary/20 text-primary font-bold' : 'bg-muted text-muted-foreground'}`}>TRL</Badge>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className={`font-bold ${isPnlPositive ? 'text-success' : 'text-destructive'}`}>
                                  {isPnlPositive ? '+' : ''}{formatCurrency(pnlVal)}
                                </span>
                                <span className={`text-[10px] ${isPnlPositive ? 'text-success/70' : 'text-destructive/70'}`}>
                                  {formatPct(pnlPctVal)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}