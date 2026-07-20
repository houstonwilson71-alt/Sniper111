import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Meme Coin Sniper",
  description: "Autonomous Solana + BSC meme coin sniper and trading dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-black text-white`}>
        <Providers>
          <div className="flex h-screen w-full overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
