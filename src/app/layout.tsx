import { headers } from "next/headers";

import Script from "next/script";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { publicEnv } from "@/lib/env";
import { QueryProvider } from "./_providers/QueryProvider";
import "./globals.css";

import type { Metadata } from "next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  weight: ["700", "900"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TradeMusic — Secure Track Trade Escrow",
  description:
    "Upload, preview, and trade unreleased tracks with mutual escrow. No accounts, no trust required.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading headers forces dynamic rendering so the nonce is unique per request.
  // Next.js reads x-nonce automatically and applies it to inline scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <TooltipProvider>
            <div className="flex flex-1 flex-col">{children}</div>
          </TooltipProvider>
          <Toaster position="bottom-right" richColors />
        </QueryProvider>
        {publicEnv.CF_BEACON_TOKEN && (
          <Script
            nonce={nonce}
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token":"${publicEnv.CF_BEACON_TOKEN}"}`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
