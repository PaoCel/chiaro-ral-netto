import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chiaro — Calcolo stipendio netto 2026",
  description: "Dalla RAL al netto, senza scatole nere. Una simulazione trasparente per il caso standard di un dipendente a Milano.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body className={`${body.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
