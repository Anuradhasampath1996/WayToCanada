import React from "react";
import { cn } from "@/lib/utils";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "RCICMASTER – Your Immigration Journey Starts Here",
  description:
    "RCICMASTER helps you navigate the Canadian immigration process with expert consultants, tools, and resources."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, "font-sans antialiased bg-background text-foreground")}>
        {children}
      </body>
    </html>
  );
}
