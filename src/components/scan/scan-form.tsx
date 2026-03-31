"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Loader2, Smartphone, Tablet, Monitor } from "lucide-react";
import { VIEWPORT_PRESETS } from "@/lib/scanner/viewports";
import type { AiProvider, ViewportType } from "@/lib/types";

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
    .url("Please enter a valid URL (e.g. https://example.com)"),
  viewports: z
    .array(z.string())
    .min(1, "Select at least one viewport"),
  aiEnabled: z.boolean(),
  aiProvider: z.enum(["claude", "openai"]).optional(),
});

type ScanFormValues = z.infer<typeof scanFormSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typeIcons: Record<ViewportType, React.ReactNode> = {
  mobile: <Smartphone className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
  desktop: <Monitor className="h-4 w-4" />,
};

const typeLabels: Record<ViewportType, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

function groupViewportsByType() {
  const groups: Record<ViewportType, typeof VIEWPORT_PRESETS> = {
    mobile: [],
    tablet: [],
    desktop: [],
  };
  for (const vp of VIEWPORT_PRESETS) {
    groups[vp.type].push(vp);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanForm() {
  const router = useRouter();

  // Form state
  const [url, setUrl] = useState("");
  const [selectedViewports, setSelectedViewports] = useState<string[]>(
    VIEWPORT_PRESETS.map((v) => v.name),
  );
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>("claude");

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const viewportGroups = useMemo(groupViewportsByType, []);
  const allSelected = selectedViewports.length === VIEWPORT_PRESETS.length;

  // ----- Viewport toggles --------------------------------------------------

  function toggleViewport(name: string) {
    setSelectedViewports((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name],
    );
    setErrors((prev) => {
      const next = { ...prev };
      delete next.viewports;
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedViewports([]);
    } else {
      setSelectedViewports(VIEWPORT_PRESETS.map((v) => v.name));
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.viewports;
      return next;
    });
  }

  // ----- Submit -------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const values: ScanFormValues = {
      url: url.trim(),
      viewports: selectedViewports,
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
        body: JSON.stringify(result.data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error ?? `Server responded with ${res.status}`,
        );
      }

      const { id } = (await res.json()) as { id: string };
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
              <p className="text-sm text-destructive">{errors.url}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Viewports */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Viewports</CardTitle>
              <CardDescription>
                Choose the screen sizes to test against.
              </CardDescription>
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm font-medium text-primary hover:underline"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {(Object.keys(viewportGroups) as ViewportType[]).map((type) => (
            <div key={type}>
              <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
                {typeIcons[type]}
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {typeLabels[type]}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {viewportGroups[type].map((vp) => {
                  const checked = selectedViewports.includes(vp.name);
                  return (
                    <label
                      key={vp.name}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors select-none ${
                        checked
                          ? "border-primary/50 bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleViewport(vp.name)}
                        className="accent-primary h-4 w-4 rounded"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{vp.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {vp.width} x {vp.height}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {errors.viewports && (
            <p className="text-sm text-destructive">{errors.viewports}</p>
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
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
