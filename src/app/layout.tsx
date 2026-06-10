import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopNav } from "@/components/layout/top-nav";
import "./globals.css";

// Fonts vendored under /public/fonts/ to keep builds hermetic (Google Fonts
// fetches are unreliable inside Docker build networks).
const urbanist = localFont({
  variable: "--font-urbanist",
  display: "swap",
  src: [
    {
      path: "../../public/fonts/urbanist-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [
    {
      path: "../../public/fonts/geist-mono-latin.woff",
      weight: "400",
      style: "normal",
    },
  ],
});

export const metadata: Metadata = {
  title: "REALSTACK Audit — UI/UX Auditing Tool",
  description:
    "Scan websites across multiple viewports and get comprehensive UI/UX audit reports powered by AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${urbanist.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider>
          <TopNav />
          <main className="mx-auto w-full max-w-[1320px] pb-16">
            {children}
          </main>
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
