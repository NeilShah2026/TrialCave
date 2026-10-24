import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { DemoBanner } from "@/components/demo-banner";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TrialCave",
  description:
    "Find recruiting clinical trials in Massachusetts, matched to your own health records. Your data, your choice, your paycheck.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <DemoBanner />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
