import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flyggo Administrator",
  description: "Flyggo Internal Management Portal",
};

import { ThemeProvider } from "@/components/ThemeProvider";
import { RoleGuardWrapper as RoleGuard } from "@/components/RoleGuardWrapper";
import { MobileBlocker } from "@/components/MobileBlocker";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={${geistSans.variable}  antialiased}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <MobileBlocker />
          <RoleGuard />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
