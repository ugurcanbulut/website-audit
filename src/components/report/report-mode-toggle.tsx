"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportView } from "./report-mode";

/**
 * Segmented Internal / Client toggle. Writes the audience to the `?view=` URL
 * param so the report re-renders server-side in the chosen mode (and the choice
 * is shareable / survives reload). "internal" is the default, so it drops the
 * param rather than writing view=internal.
 */
export function ReportModeToggle({ current }: { current: ReportView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setView(view: ReportView) {
    if (view === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (view === "internal") params.delete("view");
    else params.set("view", "client");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const options: { value: ReportView; label: string; icon: typeof Eye }[] = [
    { value: "internal", label: "Internal", icon: Eye },
    { value: "client", label: "Client", icon: Users },
  ];

  return (
    <div
      role="tablist"
      aria-label="Report audience"
      className="inline-flex items-center rounded-lg border border-border bg-secondary p-0.5"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = value === current;
        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            onClick={() => setView(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-sm font-semibold transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
