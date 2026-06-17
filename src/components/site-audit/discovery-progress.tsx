"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Network } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Polls the discovery crawl while it runs and refreshes the server page once it
 * completes (which flips the site audit into the page-selection step).
 */
export function DiscoveryProgress({
  crawlId,
  seedUrl,
}: {
  crawlId: string;
  seedUrl: string;
}) {
  const router = useRouter();
  const [pages, setPages] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      // Re-render the server component every tick: it owns the
      // discovering→selecting transition, so this surfaces the tree as soon as
      // the crawl finishes without depending on the client reading the status.
      router.refresh();
      try {
        const res = await fetch(`/api/crawls/${crawlId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setPages(data.pagesCrawled ?? data.pages?.length ?? null);
      } catch {
        // transient; keep polling
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [crawlId, router]);

  return (
    <Card className="gap-0 p-6">
      <div className="flex items-center gap-3.5">
        <div className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[var(--brand-soft)]">
          <Network className="size-[26px] animate-pulse text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[20px] leading-tight tracking-[-0.02em]">Discovering pages…</h2>
          <p className="mt-1 truncate font-mono text-[13px] text-muted-foreground">{seedUrl}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-[var(--ink-2)]">
        <Loader2 className="size-4 animate-spin text-primary" />
        {pages != null ? `${pages} page${pages === 1 ? "" : "s"} found so far…` : "Crawling the site…"}
      </div>
    </Card>
  );
}
