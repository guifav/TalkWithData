import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { McpAccessProvider } from "@/hooks/mcp-access-context";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { FirebaseRuntimeConfig } from "@/components/firebase-runtime-config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Talk With Data - Talk With Data",
  description:
    "Internal Talk With Data platform for dashboards and reports.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <FirebaseRuntimeConfig />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <McpAccessProvider>
              {children}
              <Toaster />
            </McpAccessProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
