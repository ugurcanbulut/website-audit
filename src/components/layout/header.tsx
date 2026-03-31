"use client";

import Link from "next/link";
import { Monitor, Settings } from "lucide-react";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Monitor className="h-5 w-5" />
          <span>UI Audit</span>
        </Link>

        <nav className="ml-auto flex items-center gap-2">
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
