import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/AppShell";

const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});
const fontMono = JetBrains_Mono({
  variable: "--font-label-mono",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Hệ thống Quản lý Sự cố ATTT",
  description: "Hệ thống quản lý sự cố an toàn thông tin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}