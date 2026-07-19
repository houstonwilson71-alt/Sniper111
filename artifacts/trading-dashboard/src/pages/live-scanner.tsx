import { useListTokens } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber, formatTimeAgoToNow } from '@/lib/utils';
import { Activity, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function LiveScanner() {
  const { data: tokensResponse, isLoading } = useListTokens({ limit: 100 }, { query: { refetchInterval: 2000 } });

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-2rem)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          Live Scanner
        </h1>
        <p className="text-muted-foreground">Real-time stream of detected tokens across monitored chains.</p>
      </div>

      <Card className="bg-card border-card-border flex-1 flex flex-col min-h-0">
        <CardHeader className="py-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Target Feed</span>
            <div className="flex items-center gap-2 text-xs font-normal">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success"></span> Passed</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive"></span> Failed</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array(10).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !tokensResponse?.tokens || tokensResponse.tokens.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Waiting for target acquisitions...</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 z-10 shadow-[0_1px_0_hsl(var(--border))]">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Chain</th>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium text-right">Liquidity</th>
                  <th className="px-4 py-3 font-medium text-right">Volume</th>
                  <th className="px-4 py-3 font-medium text-right">Holders</th>
                  <th className="px-4 py-3 font-medium text-right">Age</th>
                  <th className="px-4 py-3 font-medium text-right">Top 10%</th>
                  <th className="px-4 py-3 font-medium text-center">Rug Score</th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y border-t border-border font-mono text-xs">
                {tokensResponse.tokens.map(token => (
                  <tr 
                    key={token.id} 
                    className={`hover:bg-muted/50 transition-colors ${
                      token.filterPassed ? 'bg-success/5 border-l-2 border-l-success' : 'opacity-70 border-l-2 border-l-transparent hover:border-l-destructive/50'
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatTimeAgoToNow(token.detectedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-sans py-0 ${token.chain === 'solana' ? 'text-purple-400 border-purple-500/30 bg-purple-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
                        {token.chain === 'solana' ? 'SOL' : 'BSC'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-col">
                        <span className={token.filterPassed ? 'text-foreground' : 'text-muted-foreground'}>{token.symbol}</span>
                        <span className="text-[10px] text-muted-foreground opacity-50 truncate max-w-[100px]">{token.address.slice(0, 8)}...</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(token.liquidityUsd)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(token.volumeUsd)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(token.holders)}</td>
                    <td className="px-4 py-3 text-right">{token.ageSeconds}s</td>
                    <td className="px-4 py-3 text-right">{(token.top10Pct).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {token.rugScore > 3 ? (
                          <ShieldAlert className="h-3 w-3 text-destructive" />
                        ) : token.rugScore > 1 ? (
                          <ShieldAlert className="h-3 w-3 text-orange-500" />
                        ) : (
                          <ShieldCheck className="h-3 w-3 text-success" />
                        )}
                        <span className={token.rugScore > 3 ? 'text-destructive' : token.rugScore > 1 ? 'text-orange-500' : 'text-success'}>
                          {token.rugScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {token.filterPassed ? (
                        <Badge className="bg-success/20 text-success hover:bg-success/30 border-0 font-bold tracking-wider">PASS</Badge>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="text-destructive border-destructive/30 font-bold tracking-wider">FAIL</Badge>
                          {token.failReasons && token.failReasons.length > 0 && (
                            <span className="text-[9px] text-destructive/70 max-w-[120px] truncate" title={token.failReasons.join(', ')}>
                              {token.failReasons[0]}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
