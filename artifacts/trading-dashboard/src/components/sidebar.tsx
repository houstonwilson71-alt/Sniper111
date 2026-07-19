"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ScanLine,
  Wallet,
  ArrowLeftRight,
  History,
  Settings,
  AlertTriangle,
  Play,
  Square,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live", label: "Live Scanner", icon: ScanLine },
  { href: "/positions", label: "Positions", icon: Wallet },
  { href: "/trades", label: "Trade Log", icon: History },
  { href: "/config", label: "Config", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: status } = useQuery({ queryKey: ["bot-status"], queryFn: api.getBotStatus });

  const start = useMutation({
    mutationFn: api.startBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-status"] });
      toast.success("Bot started");
    },
    onError: (e) => toast.error(e.message),
  });

  const stop = useMutation({
    mutationFn: api.stopBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-status"] });
      toast.success("Bot stopped");
    },
  });

  const emergency = useMutation({
    mutationFn: () => api.emergencyStop("Manual emergency stop from dashboard"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-status"] });
      toast.error("EMERGENCY STOP ACTIVATED");
    },
  });

  const running = status?.running ?? false;
  const emergencyStopped = status?.emergencyStopped ?? false;
  const live = status?.liveTradingEnabled ?? false;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="p-5 border-b border-zinc-800">
        <h1 className="text-lg font-bold tracking-tight text-emerald-400">MEME SNIPER</h1>
        <p className="text-xs text-zinc-500">Solana + BSC autonomous trader</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Live trading</span>
          <span className={cn("font-semibold", live ? "text-red-500" : "text-amber-400")}>
            {live ? "ENABLED" : "DISABLED"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {running ? (
            <button
              onClick={() => stop.mutate()}
              className="col-span-2 flex items-center justify-center gap-2 rounded-md bg-amber-500/10 text-amber-400 px-3 py-2 text-sm font-medium hover:bg-amber-500/20"
            >
              <Square className="h-4 w-4" /> Stop Bot
            </button>
          ) : (
            <button
              onClick={() => start.mutate()}
              disabled={emergencyStopped}
              className="col-span-2 flex items-center justify-center gap-2 rounded-md bg-emerald-500/10 text-emerald-400 px-3 py-2 text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Start Bot
            </button>
          )}
          <button
            onClick={() => emergency.mutate()}
            className="col-span-2 flex items-center justify-center gap-2 rounded-md bg-red-500/10 text-red-500 px-3 py-2 text-sm font-bold hover:bg-red-500/20"
          >
            <ShieldAlert className="h-4 w-4" /> EMERGENCY STOP
          </button>
        </div>

        {emergencyStopped && (
          <div className="flex items-start gap-2 rounded-md bg-red-950/40 p-2 text-xs text-red-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Emergency stop active. Reset in Config.</span>
          </div>
        )}
      </div>
    </aside>
  );
}
