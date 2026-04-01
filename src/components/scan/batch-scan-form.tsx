"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DeviceSelector } from "./device-selector";
import { DEFAULT_DEVICES } from "@/lib/scanner/devices";
import type { AiProvider, BrowserEngine } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BatchScanForm() {
  const router = useRouter();
  const [urlText, setUrlText] = useState("");
  const [batchName, setBatchName] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<string[]>(DEFAULT_DEVICES);
  const [browserEngine, setBrowserEngine] = useState<BrowserEngine>("chromium");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>("claude");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse URLs from textarea
  const urls = urlText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const validUrls = urls.filter((u) => {
    try {
      new URL(u);
      return true;
    } catch {
      return false;
    }
  });
  const invalidCount = urls.length - validUrls.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validUrls.length === 0) {
      setError("Enter at least one valid URL");
      return;
    }
    if (selectedDevices.length === 0) {
      setError("Select at least one device");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: validUrls,
          name: batchName || undefined,
          devices: selectedDevices,
          browserEngine,
          aiEnabled,
          aiProvider: aiEnabled ? aiProvider : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ? JSON.stringify(data.error) : "Failed to create batch");
        return;
      }
      const batch = await res.json();
      toast.success(`Batch scan started (${validUrls.length} URLs)`);
      router.push(`/scan/batch/${batch.id}`);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-base text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>URLs</CardTitle>
          <CardDescription>Enter one URL per line (max 50)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Batch name (optional)"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
          />
          <textarea
            className="w-full min-h-[160px] rounded-lg border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={"https://example.com\nhttps://example.com/about\nhttps://example.com/contact"}
            aria-label="URLs to scan, one per line"
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {validUrls.length} valid URL{validUrls.length !== 1 ? "s" : ""}
            {invalidCount > 0 && (
              <span className="text-destructive">
                {" "}
                · {invalidCount} invalid
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Browser Engine */}
      <Card>
        <CardHeader>
          <CardTitle>Browser Engine</CardTitle>
          <CardDescription>
            Choose which browser engine to use for rendering and auditing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(["chromium", "firefox", "webkit"] as const).map((engine) => (
              <button
                key={engine}
                type="button"
                onClick={() => setBrowserEngine(engine)}
                aria-pressed={browserEngine === engine}
                className={cn(
                  "rounded-lg border p-3 text-center text-base transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  browserEngine === engine
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:bg-muted/50"
                )}
              >
                {engine === "chromium"
                  ? "Chrome"
                  : engine === "firefox"
                    ? "Firefox"
                    : "Safari"}
              </button>
            ))}
          </div>
          {browserEngine !== "chromium" && (
            <p className="text-sm text-muted-foreground mt-2">
              Lighthouse performance audit requires Chromium. Performance scores
              will not be available.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
          <CardDescription>
            Same devices will be used for all URLs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeviceSelector
            selected={selectedDevices}
            onChange={setSelectedDevices}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Analysis</CardTitle>
          <CardDescription>
            Enable AI-powered analysis for deeper insights and recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="batch-ai-toggle">Enable AI Analysis</Label>
            <Switch
              id="batch-ai-toggle"
              checked={aiEnabled}
              onCheckedChange={(checked) => setAiEnabled(checked)}
            />
          </div>
          {aiEnabled && (
            <div className="space-y-2">
              <Label htmlFor="batch-ai-provider">AI Provider</Label>
              <Select
                value={aiProvider}
                onValueChange={(v) => setAiProvider(v as AiProvider)}
              >
                <SelectTrigger id="batch-ai-provider" className="w-full">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude (Anthropic)</SelectItem>
                  <SelectItem value="openai">GPT-4o (OpenAI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={submitting || validUrls.length === 0 || selectedDevices.length === 0}
        size="lg"
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating batch...
          </>
        ) : (
          `Scan ${validUrls.length} URL${validUrls.length !== 1 ? "s" : ""}`
        )}
      </Button>
    </form>
  );
}
