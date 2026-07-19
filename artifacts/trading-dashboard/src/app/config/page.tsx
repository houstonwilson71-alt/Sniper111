"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Play, Square, ShieldAlert, ShieldCheck } from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEvmWallet } from "@/components/providers";
import { type BotConfig } from "@workspace/common";

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: api.getConfig });
  const { data: status } = useQuery({ queryKey: ["bot-status"], queryFn: api.getBotStatus });
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: api.getWallet });

  const solanaWallet = useWallet();
  const { address: bscAddress, connect: connectBsc } = useEvmWallet();

  const [form, setForm] = useState<Partial<BotConfig>>({});
  const [solKey, setSolKey] = useState("");
  const [bscKey, setBscKey] = useState("");

  const updateConfig = useMutation({
    mutationFn: api.updateConfig,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["config"] }); toast.success("Config saved"); },
  });

  const updateWallet = useMutation({
    mutationFn: api.updateWallet,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["wallet"] }); toast.success("Wallet config saved"); },
  });

  const start = useMutation({
    mutationFn: api.startBot,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bot-status"] }); toast.success("Bot started"); },
  });
  const stop = useMutation({
    mutationFn: api.stopBot,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bot-status"] }); toast.success("Bot stopped"); },
  });
  const emergency = useMutation({
    mutationFn: () => api.emergencyStop("Manual emergency stop from dashboard"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bot-status"] }); toast.error("Emergency stop activated"); },
  });
  const reset = useMutation({
    mutationFn: api.resetEmergency,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bot-status"] }); toast.success("Emergency stop reset"); },
  });

  const current = { ...config, ...form };
  const live = status?.liveTradingEnabled ?? false;
  const running = status?.running ?? false;
  const emergencyStopped = status?.emergencyStopped ?? false;

  const setValue = (key: keyof BotConfig, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
        <p className="text-zinc-400">Safety filters, buy/sell strategy, wallet, and bot controls.</p>
      </div>

      {/* Live trading warning */}
      <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-red-400">Real funds are at risk</p>
            <p className="text-sm text-zinc-400">
              Live trading is enabled only when the <code className="text-white">LIVE_TRADING_ENABLED=true</code> environment variable is set on the backend/executors. The dashboard never starts live trading by itself. Always test with a small burner wallet first.
            </p>
          </div>
        </div>
      </div>

      {/* Bot controls */}
      <Card>
        <CardHeader>
          <CardTitle>Bot Controls</CardTitle>
          <CardDescription>Start, stop, or emergency-stop the bot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {running ? (
              <Button onClick={() => stop.mutate()} variant="outline" className="gap-2">
                <Square className="h-4 w-4" /> Stop Bot
              </Button>
            ) : (
              <Button onClick={() => start.mutate()} disabled={emergencyStopped} className="gap-2">
                <Play className="h-4 w-4" /> Start Bot
              </Button>
            )}
            <Button onClick={() => emergency.mutate()} variant="danger" className="gap-2">
              <ShieldAlert className="h-4 w-4" /> Emergency Stop
            </Button>
            {emergencyStopped && (
              <Button onClick={() => reset.mutate()} variant="outline" className="gap-2">
                <ShieldCheck className="h-4 w-4" /> Reset Emergency
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-400">Status:</span>
            <Badge variant={running ? "success" : "outline"}>{running ? "RUNNING" : "STOPPED"}</Badge>
            <Badge variant={live ? "danger" : "warning"}>{live ? "LIVE TRADING" : "SAFETY INTERLOCK"}</Badge>
            {emergencyStopped && <Badge variant="danger">EMERGENCY</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Wallet config */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet Configuration</CardTitle>
          <CardDescription>Connect wallets or set burner private keys.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Solana Wallet</Label>
              <WalletMultiButton className="!bg-zinc-800 !text-white hover:!bg-zinc-700" />
              {solanaWallet.connected && solanaWallet.publicKey && (
                <p className="text-xs text-zinc-400">Connected: {solanaWallet.publicKey.toBase58()}</p>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Or paste Solana private key (base58)</Label>
                <Input type="password" value={solKey} onChange={(e) => setSolKey(e.target.value)} placeholder="[encrypted]" />
              </div>
            </div>
            <div className="space-y-3">
              <Label>BSC / MetaMask</Label>
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-white w-fit">
                  {bscAddress ? bscAddress : "Connect via MetaMask (injected)"}
                </div>
                <Button type="button" size="sm" onClick={connectBsc}>
                  Connect
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Or paste BSC private key (0x...)</Label>
                <Input type="password" value={bscKey} onChange={(e) => setBscKey(e.target.value)} placeholder="[encrypted]" />
              </div>
            </div>
          </div>
          <Button
            onClick={() => updateWallet.mutate({
              solanaPrivateKey: solKey || undefined,
              bscPrivateKey: bscKey || undefined,
              useWalletConnect: solanaWallet.connected || !!bscAddress,
            })}
            disabled={updateWallet.isPending}
          >
            Save Wallet Config
          </Button>
          <p className="text-xs text-zinc-500">
            Private keys are stored encrypted in the database when an <code>ENCRYPTION_KEY</code> is configured. If no key is configured, the dashboard will prompt you to set them via environment variables instead.
          </p>
        </CardContent>
      </Card>

      {/* Safety filters */}
      <Card>
        <CardHeader>
          <CardTitle>Safety Filters</CardTitle>
          <CardDescription>Tokens must pass all enabled filters to trigger a buy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FilterField
            label="Min Liquidity (USD)"
            value={current.minLiquidityUsd ?? 5000}
            min={1000}
            max={100000}
            step={1000}
            onChange={(v) => setValue("minLiquidityUsd", v)}
            format={(v) => `$${v.toLocaleString()}`}
          />
          <FilterField
            label="Max Token Age (seconds)"
            value={current.maxTokenAgeSeconds ?? 300}
            min={10}
            max={1800}
            step={10}
            onChange={(v) => setValue("maxTokenAgeSeconds", v)}
            format={(v) => `${v}s`}
          />
          <FilterField
            label="Min Unique Holders"
            value={current.minHolders ?? 25}
            min={0}
            max={500}
            step={5}
            onChange={(v) => setValue("minHolders", v)}
          />
          <FilterField
            label="Max Top-10 Holder Concentration (%)"
            value={current.maxTop10Pct ?? 35}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setValue("maxTop10Pct", v)}
            format={(v) => `${v}%`}
          />
          <FilterField
            label="Max Rug Score (0-10)"
            value={current.maxRugScore ?? 2}
            min={0}
            max={10}
            step={0.1}
            onChange={(v) => setValue("maxRugScore", v)}
          />
          <FilterField
            label="Min Volume 24h (USD)"
            value={current.minVolumeUsd ?? 1000}
            min={0}
            max={50000}
            step={500}
            onChange={(v) => setValue("minVolumeUsd", v)}
            format={(v) => `$${v.toLocaleString()}`}
          />
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={current.enableSolana ?? true} onCheckedChange={(v) => setValue("enableSolana", v)} />
              <Label>Enable Solana</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={current.enableBsc ?? true} onCheckedChange={(v) => setValue("enableBsc", v)} />
              <Label>Enable BSC</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buy settings */}
      <Card>
        <CardHeader>
          <CardTitle>Buy Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FilterField
            label="Buy Amount (SOL)"
            value={current.buyAmountSol ?? 0.01}
            min={0.001}
            max={1}
            step={0.001}
            onChange={(v) => setValue("buyAmountSol", v)}
            format={(v) => `${v} SOL`}
          />
          <FilterField
            label="Buy Amount (BNB)"
            value={current.buyAmountBnb ?? 0.01}
            min={0.001}
            max={1}
            step={0.001}
            onChange={(v) => setValue("buyAmountBnb", v)}
            format={(v) => `${v} BNB`}
          />
          <FilterField
            label="Slippage (%)"
            value={current.slippagePct ?? 15}
            min={0.5}
            max={50}
            step={0.5}
            onChange={(v) => setValue("slippagePct", v)}
            format={(v) => `${v}%`}
          />
          <FilterField
            label="Jito Tip (lamports)"
            value={current.jitoTipLamports ?? 10000}
            min={0}
            max={1000000}
            step={1000}
            onChange={(v) => setValue("jitoTipLamports", v)}
            format={(v) => `${v.toLocaleString()} lamports`}
          />
        </CardContent>
      </Card>

      {/* Sell strategy */}
      <Card>
        <CardHeader>
          <CardTitle>Sell Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FilterField
            label="Take Profit 1 (%)"
            value={current.tp1Pct ?? 100}
            min={10}
            max={1000}
            step={10}
            onChange={(v) => setValue("tp1Pct", v)}
            format={(v) => `${v}%`}
          />
          <FilterField
            label="TP1 Sell (% of position)"
            value={current.tp1SellPct ?? 50}
            min={10}
            max={100}
            step={5}
            onChange={(v) => setValue("tp1SellPct", v)}
            format={(v) => `${v}%`}
          />
          <FilterField
            label="Trailing Stop (%)"
            value={current.trailingStopPct ?? 25}
            min={5}
            max={90}
            step={1}
            onChange={(v) => setValue("trailingStopPct", v)}
            format={(v) => `${v}%`}
          />
          <FilterField
            label="Time-Based Exit (minutes)"
            value={current.timeExitMinutes ?? 120}
            min={5}
            max={1440}
            step={5}
            onChange={(v) => setValue("timeExitMinutes", v)}
            format={(v) => `${v}m`}
          />
          <FilterField
            label="Time Exit Min Profit (%)"
            value={current.timeExitMinProfitPct ?? 20}
            min={0}
            max={200}
            step={5}
            onChange={(v) => setValue("timeExitMinProfitPct", v)}
            format={(v) => `${v}%`}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => updateConfig.mutate(form)} disabled={updateConfig.isPending || Object.keys(form).length === 0}>
          Save All Changes
        </Button>
      </div>
    </div>
  );
}

function FilterField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toString(),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  format?: (val: number) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-mono text-emerald-400">{format(value)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
