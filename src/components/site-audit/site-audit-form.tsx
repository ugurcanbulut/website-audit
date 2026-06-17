"use client";

import { useState, useTransition } from "react";
import { Globe, Loader2, Network } from "lucide-react";
import { createSiteAudit } from "@/app/site-audit/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SiteAuditForm() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(150);
  const [maxDepth, setMaxDepth] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createSiteAudit(url, maxPages, maxDepth);
      // On success createSiteAudit redirects (never returns); only errors land here.
      if (res?.error) setError(res.error);
    });
  }

  return (
    <Card className="gap-0 p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-5"
      >
        <div>
          <label htmlFor="seed-url" className="mb-1.5 block text-sm font-semibold">
            Site URL
          </label>
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="seed-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com"
              autoFocus
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            We&apos;ll crawl the site to map its pages, then you pick which ones to audit.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="max-pages" className="mb-1.5 block text-sm font-semibold">
              Discovery page limit
            </label>
            <input
              id="max-pages"
              type="number"
              min={1}
              max={1000}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label htmlFor="max-depth" className="mb-1.5 block text-sm font-semibold">
              Max crawl depth
            </label>
            <input
              id="max-depth"
              type="number"
              min={1}
              max={20}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-destructive dark:bg-red-950/30">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="font-bold">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting discovery…
            </>
          ) : (
            <>
              <Network className="size-4" />
              Discover pages
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
