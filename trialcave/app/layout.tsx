import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

import { ChromeGate } from "@/components/chrome-gate";
import { DemoBanner } from "@/components/demo-banner";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  // next/font has no metric overrides for this family yet; skip the generated fallback.
  adjustFontFallback: false,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "TrialCave: find a clinical trial that fits you",
    template: "%s · TrialCave",
  },
  description:
    "Find recruiting clinical trials in Massachusetts, matched to your own health records. Your data, your choice, your paycheck.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // DECISION: the CSP nonce (proxy.ts) only reaches scripts on dynamically
  // rendered pages. Waiting for the request here makes every page dynamic, so a
  // prerendered page can never ship scripts the CSP would block.
  await connection();

  return (
    <html lang="en" className={`${atkinson.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:shadow-pop"
        >
          Skip to content
        </a>
        <ChromeGate>
          <DemoBanner />
        </ChromeGate>
        <div id="main-content" className="flex flex-1 flex-col">
          {children}
        </div>
        <ChromeGate>
          <SiteFooter />
        </ChromeGate>
        <Toaster />
      </body>
    </html>
  );
}
