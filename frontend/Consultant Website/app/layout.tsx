import React from "react";
import { cn } from "@/lib/utils";
import { DM_Sans, Inter } from "next/font/google";
import "./globals.css";
import "./landing.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata = {
  title: "RCICMASTER – Consultant Portal",
  description:
    "Join the RCICMASTER consultant network. Grow your immigration practice with our platform, tools, and client management system."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, dmSans.variable, "font-sans antialiased bg-background text-foreground")}>
        {children}
      </body>
    </html>
  );
}
