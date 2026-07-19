"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { ThemeProvider } from "next-themes";
import { type ReactNode, createContext, useContext, useEffect, useCallback } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

const solanaNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
  ? WalletAdapterNetwork.Mainnet
  : WalletAdapterNetwork.Devnet;

const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  || (solanaNetwork === WalletAdapterNetwork.Mainnet
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

interface EvmWalletContextType {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const EvmWalletContext = createContext<EvmWalletContextType>({
  address: null,
  connect: async () => {},
  disconnect: () => {},
});

export function useEvmWallet() {
  return useContext(EvmWalletContext);
}

function EvmWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !(window as unknown as { ethereum?: { request: (args: unknown) => Promise<string[]> } }).ethereum) {
      throw new Error("MetaMask not found");
    }
    const eth = (window as unknown as { ethereum: { request: (args: unknown) => Promise<string[]> } }).ethereum;
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    if (accounts && accounts[0]) setAddress(accounts[0]);
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = (window as unknown as { ethereum?: { request: (args: unknown) => Promise<string[]> } }).ethereum;
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((accounts) => {
      if (accounts && accounts[0]) setAddress(accounts[0]);
    });
  }, []);

  return (
    <EvmWalletContext.Provider value={{ address, connect, disconnect }}>
      {children}
    </EvmWalletContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: 5000,
        staleTime: 2000,
      },
    },
  }));

  const wallets = [new PhantomWalletAdapter()];

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <EvmWalletProvider>
          <ConnectionProvider endpoint={solanaEndpoint}>
            <WalletProvider wallets={wallets} autoConnect>
              <WalletModalProvider>
                {children}
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </EvmWalletProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
