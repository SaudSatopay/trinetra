import type { Metadata } from "next";
import { Archivo, Bricolage_Grotesque, Space_Mono } from "next/font/google";
import "./globals.css";

// Foundry type system — distinctive + industrial, NOT Inter/Roboto:
// Archivo (body/UI) · Bricolage Grotesque (display + wordmark) · Space Mono (telemetry/labels).
const sans = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "TRINETRA · Compound-Risk Intelligence",
  description:
    "Industrial safety intelligence for zero-harm operations — catching the lethal combinations no single sensor flags.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
