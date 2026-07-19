import { Link, useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { useGetBotStatus, useStartBot, useStopBot } from '@workspace/api-client-react';
import {
  Activity,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  Settings,
  Terminal,
  Power,
  PowerOff
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: botStatus } = useGetBotStatus({ query: { refetchInterval: 3000 } });
  const startBot = useStartBot();
  const stopBot = useStopBot();

  const isRunning = botStatus?.running;

  const handleToggleBot = () => {
    if (isRunning) {
      stopBot.mutate(undefined);
    } else {
      startBot.mutate(undefined);
    }
  };

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-3">
            <Terminal className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg tracking-tight uppercase text-foreground">Sniper<span className="text-primary">Bot</span></span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/'}>
                    <Link href="/">
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/live'}>
                    <Link href="/live">
                      <Activity />
                      <span>Live Scanner</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/positions'}>
                    <Link href="/positions">
                      <LineChart />
                      <span>Positions</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/trades'}>
                    <Link href="/trades">
                      <ListOrdered />
                      <span>Trade Log</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === '/config'}>
                    <Link href="/config">
                      <Settings />
                      <span>Configuration</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="p-4 bg-card border-t border-border flex flex-col gap-3 rounded-lg mx-2 mb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System Status</span>
              {isRunning ? (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  ONLINE
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  OFFLINE
                </Badge>
              )}
            </div>
            <Button 
              size="sm" 
              variant={isRunning ? "destructive" : "default"}
              className="w-full font-bold uppercase tracking-wider text-xs"
              onClick={handleToggleBot}
              disabled={startBot.isPending || stopBot.isPending}
            >
              {isRunning ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
              {isRunning ? 'Halt Engine' : 'Engage Systems'}
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/50 bg-background/95 backdrop-blur px-4 sticky top-0 z-10">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <div className="flex-1" />
          {/* Top nav extras if any */}
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
