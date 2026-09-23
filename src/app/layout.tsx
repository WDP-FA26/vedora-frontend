import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SWRProvider } from "@/components/swr-provider";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vedora · Sống xanh có ý thức",
  description:
    "Mạng xã hội cho người nấu ăn chay và các đầu bếp thuần thực vật đã xác minh, nơi chia sẻ công thức, video và blog.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${jakartaSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SWRProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
