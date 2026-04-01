"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Seed URL */}
      <Card>
        <CardHeader>
          <CardTitle>Seed URL</CardTitle>
          <CardDescription>
            The starting page to crawl. The crawler will discover and follow
            internal links from this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="crawl-url">URL</Label>
            <Input
              id="crawl-url"
              type="url"
              placeholder="https://example.com"
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
            />
            {errors.url && (
              <p className="text-base text-destructive">{errors.url}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Crawl Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Crawl Settings</CardTitle>
          <CardDescription>
            Configure how the crawler explores the website.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Max Pages */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="max-pages">Max Pages</Label>
              <span className="text-base text-muted-foreground tabular-nums">
                {maxPages}
              </span>
            </div>
            <input
              id="max-pages"
              type="range"
              min={1}
              max={1000}
              step={1}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1</span>
              <span>1000</span>
            </div>
            {errors.maxPages && (
              <p className="text-base text-destructive">{errors.maxPages}</p>
            )}
          </div>

          {/* Max Depth */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="max-depth">Max Depth</Label>
              <span className="text-base text-muted-foreground tabular-nums">
                {maxDepth}
              </span>
            </div>
            <input
              id="max-depth"
              type="range"
              min={1}
              max={20}
              step={1}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1</span>
              <span>20</span>
            </div>
            {errors.maxDepth && (
              <p className="text-base text-destructive">{errors.maxDepth}</p>
            )}
          </div>

          {/* Crawl Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="crawl-rate">
                Crawl Rate (ms between requests)
              </Label>
              <span className="text-base text-muted-foreground tabular-nums">
                {crawlRate}ms
              </span>
            </div>
            <input
              id="crawl-rate"
              type="range"
              min={100}
              max={10000}
              step={100}
              value={crawlRate}
              onChange={(e) => setCrawlRate(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>100ms (fast)</span>
              <span>10000ms (slow)</span>
            </div>
            {errors.crawlRate && (
              <p className="text-base text-destructive">{errors.crawlRate}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Crawler Behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Crawler Behavior</CardTitle>
          <CardDescription>
            Control how the crawler interacts with the target website.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="respect-robots">Respect robots.txt</Label>
            <Switch
              id="respect-robots"
              checked={respectRobotsTxt}
              onCheckedChange={(checked) => setRespectRobotsTxt(checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="follow-sitemaps">Follow sitemaps</Label>
            <Switch
              id="follow-sitemaps"
              checked={followSitemaps}
              onCheckedChange={(checked) => setFollowSitemaps(checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Exclude Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Exclude Patterns</CardTitle>
          <CardDescription>
            URL patterns to skip (one per line). Supports glob patterns like{" "}
            <code className="text-sm">/blog/*</code> or{" "}
            <code className="text-sm">*.pdf</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            placeholder={"/admin/*\n*.pdf\n/wp-json/*"}
            value={excludePatterns}
            onChange={(e) => setExcludePatterns(e.target.value)}
            rows={4}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </CardContent>
      </Card>

      {/* Submit */}
      {submitError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-base text-destructive">
          {submitError}
        </div>
      )}

      <Button type="submit" disabled={submitting} size="lg" className="w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Starting Crawl...
          </>
        ) : (
          "Start Crawl"
        )}
      </Button>
    </form>
  );
}
