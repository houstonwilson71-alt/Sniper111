"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { useEvmWallet } from "@/components/providers";

export interface WalletBalances {
  solana: { sol: number | null; loading: boolean; error: string | null };
  bsc: { bnb: number | null; loading: boolean; error: string | null };
}

export function useWalletBalances(): WalletBalances {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { address: bscAddress } = useEvmWallet();

  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solLoading, setSolLoading] = useState(false);
  const [solError, setSolError] = useState<string | null>(null);

  const [bscBalance, setBscBalance] = useState<number | null>(null);
  const [bscLoading, setBscLoading] = useState(false);
  const [bscError, setBscError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      setSolBalance(null);
      return;
    }
    setSolLoading(true);
    connection
      .getBalance(publicKey)
      .then((lamports) => {
        setSolBalance(lamports / LAMPORTS_PER_SOL);
        setSolError(null);
      })
      .catch((err) => setSolError(err.message || "Solana balance failed"))
      .finally(() => setSolLoading(false));
  }, [connection, publicKey, connected]);

  useEffect(() => {
    if (!bscAddress || typeof window === "undefined") {
      setBscBalance(null);
      return;
    }
    const eth = (window as unknown as { ethereum?: { request: (args: unknown) => Promise<string> } }).ethereum;
    if (!eth) {
      setBscError("MetaMask not available");
      return;
    }
    setBscLoading(true);
    eth
      .request({ method: "eth_getBalance", params: [bscAddress, "latest"] })
      .then((hex) => {
        const wei = BigInt(hex);
        setBscBalance(Number(wei) / 1e18);
        setBscError(null);
      })
      .catch((err) => setBscError(err.message || "BSC balance failed"))
      .finally(() => setBscLoading(false));
  }, [bscAddress]);

  return {
    solana: { sol: solBalance, loading: solLoading, error: solError },
    bsc: { bnb: bscBalance, loading: bscLoading, error: bscError },
  };
}
