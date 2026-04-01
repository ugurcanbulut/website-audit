"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { DEFAULT_DEVICES } from "@/lib/scanner/devices";
import type { AiProvider, BrowserEngine } from "@/lib/types";
import { cn } from "@/lib/utils";

import { toast } from "sonner";
import { DeviceSelector } from "@/components/scan/device-selector";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const scanFormSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .url("Please enter a valid URL"),
  devices: z
    .array(z.string())
    .min(1, "Select at least one device"),
  browserEngine: z.enum(["chromium", "firefox", "webkit"]).default("chromium"),
  aiEnabled: z.boolean(),
  aiProvider: z.enum(["claude", "openai"]).optional(),
});

type ScanFormValues = z.infer<typeof scanFormSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanForm() {
  const router = useRouter();

  // Form state
  const [url, setUrl] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<string[]>(DEFAULT_DEVICES);
  const [browserEngine, setBrowserEngine] = useState<BrowserEngine>("chromium");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>("claude");

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ----- Submit -------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const values: ScanFormValues = {
      url: url.trim(),
      devices: selectedDevices,
      browserEngine,
      aiEnabled,
      aiProvider: aiEnabled ? aiProvider : undefined,
    };

    const result = scanFormSchema.safeParse(values);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.data.url,
          devices: selectedDevices,
          browserEngine,
          aiEnabled: result.data.aiEnabled,
          aiProvider: aiEnabled ? aiProvider : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error ?? `Server responded with ${res.status}`,
        );
      }

      const { id } = (await res.json()) as { id: string };
      toast.success("Scan started");
      router.push(`/scan/${id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setSubmitting(false);
    }
  }

  // ----- Render -------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* URL */}
      <Card>
        <CardHeader>
          <CardTitle>Target URL</CardTitle>
          <CardDescription>
            The website you want to audit. Must be a full URL including the
            protocol (https://).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
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
                {engine === "chromium" ? "Chrome" : engine === "firefox" ? "Firefox" : "Safari"}
              </button>
            ))}
          </div>
          {browserEngine !== "chromium" && (
            <p className="text-sm text-muted-foreground mt-2">
              Lighthouse performance audit requires Chromium. Performance scores will not be available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Devices */}
      <Card>
        <CardHeader>
          <CardTitle>Devices</CardTitle>
          <CardDescription>
            Choose the devices and screen sizes to test against.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeviceSelector
            selected={selectedDevices}
            onChange={(devices) => {
              setSelectedDevices(devices);
              setErrors((prev) => {
                const next = { ...prev };
                delete next.devices;
                return next;
              });
            }}
          />
          {errors.devices && (
            <p className="text-base text-destructive mt-2">{errors.devices}</p>
          )}
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle>AI Analysis</CardTitle>
          <CardDescription>
            Enable AI-powered analysis for deeper insights and recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="ai-toggle">Enable AI Analysis</Label>
            <Switch
              id="ai-toggle"
              checked={aiEnabled}
              onCheckedChange={(checked) => setAiEnabled(checked)}
            />
          </div>

          {aiEnabled && (
            <div className="space-y-2">
              <Label htmlFor="ai-provider">AI Provider</Label>
              <Select
                value={aiProvider}
                onValueChange={(value) => setAiProvider(value as AiProvider)}
              >
                <SelectTrigger id="ai-provider" className="w-full">
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

      {/* Submit */}
      {submitError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-base text-destructive">
          {submitError}
        </div>
      )}

      <Button
        type="submit"
        disabled={submitting}
        size="lg"
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Starting Scan...
          </>
        ) : (
          "Start Scan"
        )}
      </Button>
    </form>
  );
}
