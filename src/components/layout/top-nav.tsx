"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ScanSearch,
  Layers,
  History,
  Globe,
  Settings,
  Plus,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_GROUPS = [
  {
    label: "Website Audit",
    prefix: "/scan",
    items: [
      { title: "New Scan", url: "/scan/new", icon: ScanSearch },
      { title: "Batch Scan", url: "/scan/batch", icon: Layers },
      { title: "Scan History", url: "/scan/history", icon: History },
    ],
  },
  {
    label: "SEO Crawl",
    prefix: "/crawl",
    items: [
      { title: "New Crawl", url: "/crawl/new", icon: Globe },
      { title: "Compare Crawls", url: "/crawl/compare", icon: Layers },
      { title: "Crawl History", url: "/crawl/history", icon: History },
    ],
  },
];

function ActiveBar() {
  return (
    <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-primary" />
  );
}

function NavDropdown({
  group,
  active,
  pathname,
}: {
  group: (typeof NAV_GROUPS)[number];
  active: boolean;
  pathname: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "relative flex h-full items-center gap-1 text-[14.5px] outline-none transition-colors",
          active
            ? "font-bold text-foreground"
            : "font-semibold text-muted-foreground hover:text-foreground"
        )}
      >
        {group.label}
        <ChevronDown className="size-[15px] transition-transform data-popup-open:rotate-180" />
        {active && <ActiveBar />}
      </DropdownMenuTrigger>
      <DropdownMenuContent sideOffset={10} className="w-[220px] rounded-xl p-1.5">
        {group.items.map((item) => {
          const isActive = pathname === item.url;
          return (
            <DropdownMenuItem
              key={item.url}
              render={<Link href={item.url} />}
              className={cn(
                "gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold",
                isActive && "bg-[var(--brand-soft)] text-primary focus:bg-[var(--brand-soft)] focus:text-primary"
              )}
            >
              <item.icon
                className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")}
              />
              {item.title}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-[68px] border-b bg-white/[.88] backdrop-blur-[10px]">
      <div className="mx-auto flex h-full max-w-[1320px] items-center justify-between px-7">
        <div className="flex h-full items-center gap-9">
          <Link href="/" aria-label="REALSTACK — Dashboard">
            <Logo height={26} />
          </Link>
          <nav className="flex h-full items-center gap-7">
            <Link
              href="/"
              className={cn(
                "relative flex h-full items-center text-[14.5px] transition-colors",
                pathname === "/"
                  ? "font-bold text-foreground"
                  : "font-semibold text-muted-foreground hover:text-foreground"
              )}
            >
              Dashboard
              {pathname === "/" && <ActiveBar />}
            </Link>
            {NAV_GROUPS.map((group) => (
              <NavDropdown
                key={group.label}
                group={group}
                active={pathname.startsWith(group.prefix)}
                pathname={pathname}
              />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/scan/new"
            className={cn(buttonVariants({ variant: "default" }), "h-10 gap-1.5 px-4 font-bold")}
          >
            <Plus className="size-4" />
            New Scan
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className={cn(
              "flex size-10 items-center justify-center rounded-xl border transition-colors",
              pathname === "/settings"
                ? "border-primary bg-[var(--brand-soft)] text-primary"
                : "border-input bg-card text-[var(--ink-2)] hover:bg-secondary"
            )}
          >
            <Settings className="size-[18px]" />
          </Link>
        </div>
      </div>
    </header>
  );
}
