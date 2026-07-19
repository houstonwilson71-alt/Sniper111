import { useGetPerformanceSummary, useGetEquityCurve, useGetLiveFeed, useListTrades } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPct, formatNumber, formatTimeAgoToNow } from '@/lib/utils';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Crosshair, DollarSign, Percent, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({ title, value, subtitle, icon: Icon, valueClass = '' }: { title: string, value: React.ReactNode, subtitle?: React.ReactNode, icon: any, valueClass?: string }) {
  return (
    <Card className="bg-card border-card-border overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform duration-500">
        <Icon className="w-24 h-24" />
      </div>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 z-10 relative">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="z-10 relative">
        <div className={`text-3xl font-bold tracking-tight ${valueClass}`}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetPerformanceSummary({ query: { refetchInterval: 5000 } });
  const { data: equityData, isLoading: isLoadingEquity } = useGetEquityCurve({ period: '7d' }, { query: { refetchInterval: 10000 } });
  const { data: liveFeed, isLoading: isLoadingFeed } = useGetLiveFeed({ query: { refetchInterval: 5000 } });
  const { data: recentTradesResponse, isLoading: isLoadingTrades } = useListTrades({ limit: 5 }, { query: { refetchInterval: 5000 } });

  const pnlClass = (val?: number) => !val ? '' : val > 0 ? 'text-success' : val < 0 ? 'text-destructive' : '';
  const pnlIcon = (val?: number) => !val ? null : val > 0 ? <ArrowUpRight className="inline w-4 h-4 mr-1" /> : val < 0 ? <ArrowDownRight className="inline w-4 h-4 mr-1" /> : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Command Center</h1>
        <p className="text-muted-foreground">Real-time performance overview and system activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoadingSummary || !summary ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl bg-card border border-border" />)
        ) : (
          <>
            <StatCard 
              title="Total P&L" 
              value={<span className={pnlClass(summary.totalPnlUsd)}>{pnlIcon(summary.totalPnlUsd)}{formatCurrency(Math.abs(summary.totalPnlUsd))}</span>}
              subtitle={`${formatPct(summary.totalPnlPct)} all-time return`}
              icon={DollarSign}
            />
            <StatCard 
              title="Win Rate" 
              value={formatPct(summary.winRate)}
              subtitle={`${summary.winningTrades}W / ${summary.losingTrades}L (${summary.totalTrades} total)`}
              icon={Crosshair}
              valueClass={summary.winRate > 50 ? 'text-success' : 'text-primary'}
            />
            <StatCard 
              title="Open Positions" 
              value={summary.openPositions}
              subtitle={`Avg hold time: ${summary.avgHoldTimeMinutes.toFixed(1)}m`}
              icon={BarChart3}
              valueClass="text-primary"
            />
            <StatCard 
              title="Tokens Scanned Today" 
              value={formatNumber(summary.tokensScannedToday)}
              subtitle={`${formatNumber(summary.tokensPassedToday)} passed filters`}
              icon={Zap}
              valueClass="text-foreground"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-4 bg-card border-card-border flex flex-col">
          <CardHeader>
            <CardTitle>Equity Curve (7D)</CardTitle>
            <CardDescription>Account balance over time</CardDescription>
          </CardHeader>
          <CardContent className="pl-0 pb-4 flex-1">
            {isLoadingEquity ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
            ) : !equityData || equityData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No equity data available</div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short' })} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      domain={['auto', 'auto']}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                      formatter={(value: number) => [formatCurrency(value), 'Equity']}
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="equityUsd" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorEquity)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 bg-card border-card-border flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Live Target Feed
            </CardTitle>
            <CardDescription>Recent scanned tokens</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {isLoadingFeed ? (
              <div className="space-y-3">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !liveFeed || liveFeed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No recent tokens</div>
            ) : (
              <div className="space-y-1">
                {liveFeed.slice(0, 8).map(token => (
                  <div key={token.id} className={`p-3 rounded-lg border flex items-center justify-between bg-background/50 ${token.filterPassed ? 'border-success/30' : 'border-destructive/30 opacity-70'}`}>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{token.symbol}</span>
                        <Badge variant="outline" className={`text-[10px] h-4 px-1 py-0 ${token.chain === 'solana' ? 'text-purple-400 border-purple-500/30' : 'text-amber-400 border-amber-500/30'}`}>
                          {token.chain === 'solana' ? 'SOL' : 'BSC'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatTimeAgoToNow(token.detectedAt)}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatCurrency(token.liquidityUsd)} Liq</div>
                      {token.filterPassed ? (
                        <span className="text-xs text-success font-medium">PASSED</span>
                      ) : (
                        <span className="text-xs text-destructive font-medium">FAILED</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle>Recent Action</CardTitle>
          <CardDescription>Latest system trades</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTrades ? (
            <div className="space-y-2">
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !recentTradesResponse?.trades || recentTradesResponse.trades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">No recent trades</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-md">Time</th>
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3 text-right rounded-tr-md">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t border-border">
                  {recentTradesResponse.trades.map(trade => (
                    <tr key={trade.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatTimeAgoToNow(trade.executedAt)}</td>
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        {trade.tokenSymbol}
                        <Badge variant="outline" className={`text-[10px] h-4 px-1 py-0 ${trade.chain === 'solana' ? 'text-purple-400 border-purple-500/30' : 'text-amber-400 border-amber-500/30'}`}>
                          {trade.chain === 'solana' ? 'SOL' : 'BSC'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={trade.side === 'buy' ? 'text-primary border-primary/30 bg-primary/10' : 'text-orange-500 border-orange-500/30 bg-orange-500/10'}>
                          {trade.side.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{formatCurrency(trade.amountUsd)}</td>
                      <td className="px-4 py-3">{formatCurrency(trade.priceUsd)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {trade.side === 'sell' && trade.pnlUsd !== null && trade.pnlUsd !== undefined ? (
                          <span className={trade.pnlUsd > 0 ? 'text-success' : 'text-destructive'}>
                            {trade.pnlUsd > 0 ? '+' : ''}{formatCurrency(trade.pnlUsd)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
