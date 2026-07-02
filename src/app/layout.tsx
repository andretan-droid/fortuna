import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Display serif — editorial numerals & headings (Aesop/Clay voice).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

// UI/body grotesk — tabular-nums verified in V7.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fortuna — Budget Tracker",
  description: "An elite, multi-user budget tracker. Ivory ↔ Obsidian.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes writes .dark on <html> pre-hydration,
    // so the server/client class attribute will legitimately differ.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${hanken.variable}`}
    >
      <body className="min-h-svh antialiased">
        <Providers>
          {children}
          <div className="grain-overlay" aria-hidden />
        </Providers>
      </body>
    </html>
  );
}
