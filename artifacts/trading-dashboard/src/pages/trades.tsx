import { useState } from 'react';
import { useListTrades } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import { Copy, Check, ListOrdered } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListTradesSide } from '@workspace/api-client-react/src/generated/api.schemas';

function CopyableHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-muted-foreground">{hash.slice(0, 6)}...{hash.slice(-4)}</span>
      <button 
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground transition-colors p-1"
        title="Copy transaction hash"
      >
        {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

export default function TradeLog() {
  const [side, setSide] = useState<ListTradesSide | 'all'>('all');
  const { data: tradesResponse, isLoading } = useListTrades(
    { side: side === 'all' ? undefined : side, limit: 100 }, 
    { query: { refetchInterval: 5000 } }
  );

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-2rem)]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
          <ListOrdered className="h-8 w-8 text-primary" />
          Trade Log
        </h1>
        <p className="text-muted-foreground">Comprehensive history of all execution events.</p>
      </div>

      <Card className="bg-card border-card-border flex-1 flex flex-col min-h-0">
        <CardHeader className="py-3 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Execution History</CardTitle>
          <Select value={side} onValueChange={(v) => setSide(v as ListTradesSide | 'all')}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
              <SelectValue placeholder="Filter side" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sides</SelectItem>
              <SelectItem value="buy">Buys Only</SelectItem>
              <SelectItem value="sell">Sells Only</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array(10).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !tradesResponse?.trades || tradesResponse.trades.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ListOrdered className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No trades found</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-card sticky top-0 z-10 shadow-[0_1px_0_hsl(var(--border))]">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium">Side</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">P&L</th>
                  <th className="px-4 py-3 font-medium text-center">Tx Hash</th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y border-t border-border font-mono text-xs">
                {tradesResponse.trades.map(trade => {
                  const isPnlPositive = trade.pnlUsd !== undefined && trade.pnlUsd !== null && trade.pnlUsd > 0;
                  const isPnlNegative = trade.pnlUsd !== undefined && trade.pnlUsd !== null && trade.pnlUsd < 0;

                  return (
                    <tr key={trade.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatShortDate(trade.executedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-sans">{trade.tokenSymbol}</span>
                          <Badge variant="outline" className={`text-[9px] h-4 px-1 font-sans py-0 ${trade.chain === 'solana' ? 'text-purple-400 border-purple-500/30' : 'text-amber-400 border-amber-500/30'}`}>
                            {trade.chain === 'solana' ? 'SOL' : 'BSC'}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`font-sans font-bold tracking-widest ${trade.side === 'buy' ? 'text-primary border-primary/30 bg-primary/10' : 'text-orange-500 border-orange-500/30 bg-orange-500/10'}`}>
                          {trade.side.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(trade.amountUsd)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(trade.priceUsd)}</td>
                      <td className="px-4 py-3 text-right">
                        {trade.side === 'sell' && trade.pnlUsd !== undefined && trade.pnlUsd !== null ? (
                          <span className={`font-bold ${isPnlPositive ? 'text-success' : isPnlNegative ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {isPnlPositive ? '+' : ''}{formatCurrency(trade.pnlUsd)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground opacity-50">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 flex justify-center">
                        <CopyableHash hash={trade.txHash} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end">
                          <Badge variant="outline" className={`font-sans border-0 ${
                            trade.status === 'confirmed' ? 'bg-success/20 text-success' : 
                            trade.status === 'failed' ? 'bg-destructive/20 text-destructive' : 
                            'bg-muted text-muted-foreground'
                          }`}>
                            {trade.status.toUpperCase()}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
