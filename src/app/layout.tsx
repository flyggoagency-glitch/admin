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
import dynamic from "next/dynamic";`nconst RoleGuard = dynamic(() => import("@/components/RoleGuard").then(m => m.RoleGuard), { ssr: false });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <RoleGuard />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

