import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useGetConfig, useUpdateConfig } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Settings, Save, AlertTriangle, Shield, Zap, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const configSchema = z.object({
  enableSolana: z.boolean(),
  enableBsc: z.boolean(),
  minLiquidityUsd: z.coerce.number().min(1000).max(100000),
  maxAgeSeconds: z.coerce.number().min(30).max(600),
  minHolders: z.coerce.number().min(10).max(500),
  maxTop10Pct: z.coerce.number().min(10).max(90),
  maxRugScore: z.coerce.number().min(0).max(10),
  minVolumeUsd: z.coerce.number().min(500).max(100000),
  buyAmountUsd: z.coerce.number().min(10).max(5000),
  slippageBps: z.coerce.number().min(10).max(1000),
  tp1Pct: z.coerce.number().min(5).max(500),
  tp1SellPct: z.coerce.number().min(10).max(100),
  tp2Pct: z.coerce.number().min(10).max(1000),
  tp2SellPct: z.coerce.number().min(10).max(100),
  trailingStopPct: z.coerce.number().min(1).max(50),
  timeExitMinutes: z.coerce.number().min(1).max(120),
});

type ConfigFormValues = z.infer<typeof configSchema>;

export default function Configuration() {
  const { data: config, isLoading } = useGetConfig();
  const updateConfig = useUpdateConfig();

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      enableSolana: true,
      enableBsc: false,
      minLiquidityUsd: 10000,
      maxAgeSeconds: 120,
      minHolders: 50,
      maxTop10Pct: 30,
      maxRugScore: 2,
      minVolumeUsd: 5000,
      buyAmountUsd: 100,
      slippageBps: 200,
      tp1Pct: 50,
      tp1SellPct: 50,
      tp2Pct: 100,
      tp2SellPct: 100,
      trailingStopPct: 15,
      timeExitMinutes: 15,
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        enableSolana: config.enableSolana,
        enableBsc: config.enableBsc,
        minLiquidityUsd: config.minLiquidityUsd,
        maxAgeSeconds: config.maxAgeSeconds,
        minHolders: config.minHolders,
        maxTop10Pct: config.maxTop10Pct,
        maxRugScore: config.maxRugScore,
        minVolumeUsd: config.minVolumeUsd,
        buyAmountUsd: config.buyAmountUsd,
        slippageBps: config.slippageBps,
        tp1Pct: config.tp1Pct,
        tp1SellPct: config.tp1SellPct,
        tp2Pct: config.tp2Pct,
        tp2SellPct: config.tp2SellPct,
        trailingStopPct: config.trailingStopPct,
        timeExitMinutes: config.timeExitMinutes,
      });
    }
  }, [config, form]);

  const onSubmit = (data: ConfigFormValues) => {
    updateConfig.mutate(
      { data },
      {
        onSuccess: () => {
          toast.success('Configuration updated successfully', {
            description: 'The new parameters have been deployed to the system.',
          });
        },
        onError: () => {
          toast.error('Failed to update configuration', {
            description: 'Check connection and try again.',
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            System Configuration
          </h1>
          <p className="text-muted-foreground">Tuning parameters for the automated sniper engine.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] w-full rounded-xl bg-card border border-border" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-card border border-border" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-card border border-border" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-card border border-border" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            System Configuration
          </h1>
          <p className="text-muted-foreground">Tuning parameters for the automated sniper engine.</p>
        </div>
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          disabled={updateConfig.isPending}
          className="bg-primary text-primary-foreground font-bold tracking-wide w-full md:w-auto"
        >
          {updateConfig.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          DEPLOY CONFIGURATION
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Target Networks */}
            <Card className="bg-card border-card-border shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-primary" />
                  Target Networks
                </CardTitle>
                <CardDescription>Select which chains the system will monitor and trade on.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="enableSolana"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">SOL</Badge>
                          Solana Network
                        </FormLabel>
                        <FormDescription>Monitor Raydium and Orca pools.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="enableBsc"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">BSC</Badge>
                          BNB Smart Chain
                        </FormLabel>
                        <FormDescription>Monitor PancakeSwap pairs.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Security Filters */}
            <Card className="bg-card border-card-border shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-primary" />
                  Security Filters
                </CardTitle>
                <CardDescription>Strict criteria to prevent honeypots and rugs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="maxRugScore"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Max Rug Score</FormLabel>
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-primary">{field.value}/10</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={0} max={10} step={1}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="pt-2"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">0 means completely clean. Reject anything higher than this score.</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxTop10Pct"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Max Top 10 Holders %</FormLabel>
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-primary">{field.value}%</span>
                      </div>
                      <FormControl>
                        <Slider
                          min={10} max={90} step={5}
                          value={[field.value]}
                          onValueChange={(vals) => field.onChange(vals[0])}
                          className="pt-2"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Reject tokens where the top 10 wallets hold more than this percentage.</FormDescription>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Liquidity & Age Filters */}
            <Card className="bg-card border-card-border shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Market Filters
                </CardTitle>
                <CardDescription>Metrics required to consider a token legitimate.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minLiquidityUsd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Liquidity (USD)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="font-mono" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minVolumeUsd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Volume (USD)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="font-mono" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minHolders"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Holders</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="font-mono" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxAgeSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Age (Seconds)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="font-mono" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Trade Strategy */}
            <Card className="bg-card border-card-border shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-primary" />
                  Entry & Exit Strategy
                </CardTitle>
                <CardDescription>Execution sizing and taking profits.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="buyAmountUsd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position Size (USD)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input type="number" {...field} className="pl-7 font-mono font-bold text-success" />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slippageBps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Slippage (BPS)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="font-mono" />
                        </FormControl>
                        <FormDescription className="text-xs">100 BPS = 1%</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">Take Profit 1</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tp1Pct"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Return (%)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="font-mono text-primary" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tp1SellPct"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sell Amount (%)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="font-mono" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mt-4">Take Profit 2</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tp2Pct"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Return (%)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="font-mono text-primary" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tp2SellPct"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sell Amount (%)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="font-mono" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mt-4">Failsafes</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="trailingStopPct"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trailing Stop (%)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="font-mono text-destructive" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="timeExitMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time Exit (Minutes)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="font-mono" />
                          </FormControl>
                          <FormDescription className="text-xs">Sell if stuck</FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </form>
      </Form>
    </div>
  );
}
