import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}>
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
