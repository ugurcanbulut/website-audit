"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Zap } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Numbered section card (Direction D crawl-form language).
function CrawlCard({
  num,
  title,
  desc,
  children,
}: {
  num: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-2xl py-0 shadow-none">
      <div className="p-5">
        <div className="mb-4 flex gap-3">
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-sm font-extrabold text-primary">
            {num}
          </span>
          <div>
            <h2 className="text-base">{title}</h2>
            {desc && (
              <p className="mt-1 text-[13px] leading-normal text-muted-foreground">
                {desc}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    </Card>
  );
}

function SliderRow({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  onChange: (value: number) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label
          htmlFor={id}
          className="whitespace-nowrap text-[13.5px] font-semibold text-[var(--ink-2)]"
        >
          {label}
        </Label>
        <span className="font-mono text-[13px] font-bold text-primary">
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="mt-1 flex justify-between font-mono text-[11px] text-[var(--faint)]">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function CrawlForm() {
  const router = useRouter();

  // Form state
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(100);
  const [maxDepth, setMaxDepth] = useState(5);
  const [crawlRate, setCrawlRate] = useState(1000);
  const [respectRobotsTxt, setRespectRobotsTxt] = useState(true);
  const [followSitemaps, setFollowSitemaps] = useState(true);
  const [excludePatterns, setExcludePatterns] = useState("");

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    // Client-side validation
    const fieldErrors: Record<string, string> = {};
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      fieldErrors.url = "URL is required";
    } else {
      try {
        new URL(trimmedUrl);
      } catch {
        fieldErrors.url = "Please enter a valid URL";
      }
    }

    if (maxPages < 1 || maxPages > 1000) {
      fieldErrors.maxPages = "Must be between 1 and 1000";
    }
    if (maxDepth < 1 || maxDepth > 20) {
      fieldErrors.maxDepth = "Must be between 1 and 20";
    }
    if (crawlRate < 100 || crawlRate > 10000) {
      fieldErrors.crawlRate = "Must be between 100 and 10000";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    const excludeArr = excludePatterns
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/crawls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl,
          maxPages,
          maxDepth,
          crawlRate,
          respectRobotsTxt,
          followSitemaps,
          excludePatterns: excludeArr.length > 0 ? excludeArr : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error
            ? typeof body.error === "string"
              ? body.error
              : JSON.stringify(body.error)
            : `Server responded with ${res.status}`,
        );
      }

      const crawl = (await res.json()) as { id: string };
      toast.success("Crawl started");
      router.push(`/crawl/${crawl.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Seed URL */}
      <CrawlCard
        num="1"
        title="Seed URL"
        desc="The crawler discovers and follows internal links from this page."
      >
        <div className="relative">
          <Globe className="absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input
            id="crawl-url"
            type="url"
            placeholder="https://example.com"
            aria-label="Seed URL"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setErrors((prev) => {
                const next = { ...prev };
                delete next.url;
                return next;
              });
            }}
            aria-invalid={!!errors.url}
            className="h-[46px] rounded-xl border-[1.5px] pl-10 font-mono text-sm"
          />
        </div>
        {errors.url && (
          <p className="mt-2 text-sm text-destructive">{errors.url}</p>
        )}
      </CrawlCard>

      {/* Crawl Settings */}
      <CrawlCard num="2" title="Crawl Settings" desc="Bound the crawl scope and pace.">
        <div className="flex flex-col gap-5">
          <SliderRow
            id="max-pages"
            label="Max pages"
            value={maxPages}
            display={String(maxPages)}
            min={1}
            max={1000}
            step={1}
            minLabel="1"
            maxLabel="1000"
            onChange={setMaxPages}
            error={errors.maxPages}
          />
          <SliderRow
            id="max-depth"
            label="Max depth"
            value={maxDepth}
            display={String(maxDepth)}
            min={1}
            max={20}
            step={1}
            minLabel="1"
            maxLabel="20"
            onChange={setMaxDepth}
            error={errors.maxDepth}
          />
          <SliderRow
            id="crawl-rate"
            label="Crawl rate (ms between requests)"
            value={crawlRate}
            display={`${crawlRate}ms`}
            min={100}
            max={10000}
            step={100}
            minLabel="100ms (fast)"
            maxLabel="10000ms (slow)"
            onChange={setCrawlRate}
            error={errors.crawlRate}
          />
        </div>
      </CrawlCard>

      {/* Crawler Behavior */}
      <CrawlCard
        num="3"
        title="Crawler Behavior"
        desc="Control how the crawler interacts with the target."
      >
        <div className="flex items-center justify-between border-b py-3">
          <Label
            htmlFor="respect-robots"
            className="text-[13.5px] font-semibold text-foreground"
          >
            Respect robots.txt
          </Label>
          <Switch
            id="respect-robots"
            checked={respectRobotsTxt}
            onCheckedChange={(checked) => setRespectRobotsTxt(checked)}
          />
        </div>
        <div className="flex items-center justify-between py-3">
          <Label
            htmlFor="follow-sitemaps"
            className="text-[13.5px] font-semibold text-foreground"
          >
            Follow sitemaps
          </Label>
          <Switch
            id="follow-sitemaps"
            checked={followSitemaps}
            onCheckedChange={(checked) => setFollowSitemaps(checked)}
          />
        </div>
      </CrawlCard>

      {/* Exclude Patterns */}
      <CrawlCard
        num="4"
        title="Exclude Patterns"
        desc="URL patterns to skip (one per line). Supports globs like /blog/* or *.pdf."
      >
        <textarea
          placeholder={"/admin/*\n*.pdf\n/wp-json/*"}
          aria-label="Exclude patterns, one per line"
          value={excludePatterns}
          onChange={(e) => setExcludePatterns(e.target.value)}
          rows={4}
          className="w-full min-w-0 resize-y rounded-xl border-[1.5px] border-input bg-background px-3.5 py-2.5 font-mono text-[13px] leading-[1.7] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </CrawlCard>

      {/* Submit */}
      {submitError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-base text-destructive">
          {submitError}
        </div>
      )}

      <Button type="submit" disabled={submitting} size="lg" className="w-full">
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Starting Crawl...
          </>
        ) : (
          <>
            <Zap className="size-4" />
            Start Crawl
          </>
        )}
      </Button>
    </form>
  );
}
