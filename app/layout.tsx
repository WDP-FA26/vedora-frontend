import type { Metadata } from "next";
import {
  Be_Vietnam_Pro,
  Figtree,
  Geist_Mono,
  Source_Sans_3,
} from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SWRProvider } from "@/components/swr-provider";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-heading",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
});

// Figtree ships no Vietnamese glyphs, so it is only for Latin text and numerals.
const figtree = Figtree({
  variable: "--font-display",
  subsets: ["latin"],
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
      className={`${sourceSans.variable} ${beVietnam.variable} ${figtree.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
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
