"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  Clock,
  Globe,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { DEFAULT_DEVICES, DEVICE_PRESETS } from "@/lib/scanner/devices";
import type { AiProvider, BrowserEngine } from "@/lib/types";
import { cn } from "@/lib/utils";

import { toast } from "sonner";
import { DeviceSelector } from "@/components/scan/device-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
// Local presentation helpers (Direction D / REALSTACK)
// ---------------------------------------------------------------------------

const ENGINE_LABELS: Record<BrowserEngine, string> = {
  chromium: "Chrome",
  firefox: "Firefox",
  webkit: "Safari",
};

function FormCard({
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
    <Card className="gap-0 px-5 py-5">
      <div className="mb-4 flex gap-3">
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-sm font-extrabold text-primary">
          {num}
        </span>
        <div>
          <h3 className="text-base leading-tight">{title}</h3>
          {desc && (
            <p className="mt-1 text-[13px] leading-normal text-muted-foreground">
              {desc}
            </p>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex w-full gap-1 rounded-xl bg-[var(--surface-2)] p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "h-9 flex-1 rounded-[9px] px-4 text-[13.5px] font-bold whitespace-nowrap transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  dim,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-[13px] whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-right text-[13px] font-bold",
          dim ? "text-[var(--faint)]" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanForm({ initialUrl = "" }: { initialUrl?: string }) {
  const router = useRouter();

  // Form state
  const [url, setUrl] = useState(initialUrl);
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
        const msg =
          typeof body?.error === "string"
            ? body.error
            : Object.values(body?.error ?? {})
                .flat()
                .filter(Boolean)
                .join(", ") || `Server responded with ${res.status}`;
        throw new Error(msg);
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

  // ----- Derived ------------------------------------------------------------

  const engineLabel = ENGINE_LABELS[browserEngine];
  const estimatedMinutes = Math.max(
    1,
    Math.round(selectedDevices.length * 0.4 + (aiEnabled ? 1 : 0)),
  );

  // ----- Render -------------------------------------------------------------

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      {/* Left column — numbered form cards */}
      <div className="flex flex-col gap-4">
        {/* 1 — Target URL */}
        <FormCard
          num="1"
          title="Target URL"
          desc="The page to audit. Include the protocol (https://)."
        >
          <Label htmlFor="url" className="sr-only">
            URL
          </Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com"
            className="font-mono"
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
            <p className="mt-2 text-base text-destructive">{errors.url}</p>
          )}
        </FormCard>

        {/* 2 — Browser Engine */}
        <FormCard
          num="2"
          title="Browser Engine"
          desc="Rendering engine for capture and audit."
        >
          <Segmented<BrowserEngine>
            value={browserEngine}
            onChange={setBrowserEngine}
            options={[
              { value: "chromium", label: "Chrome" },
              { value: "firefox", label: "Firefox" },
              { value: "webkit", label: "Safari" },
            ]}
          />
          {browserEngine !== "chromium" && (
            <div className="mt-3 flex gap-2 rounded-[10px] bg-amber-50 px-3 py-2.5">
              <TriangleAlert className="mt-px size-[15px] shrink-0 text-amber-500" />
              <span className="text-[12.5px] leading-snug text-amber-800">
                Lighthouse performance audit requires Chromium. Performance
                scores won&apos;t be available with {engineLabel}.
              </span>
            </div>
          )}
        </FormCard>

        {/* 3 — Devices */}
        <FormCard
          num="3"
          title="Devices"
          desc={`${selectedDevices.length} of ${DEVICE_PRESETS.length} viewports selected.`}
        >
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
            <p className="mt-2 text-base text-destructive">{errors.devices}</p>
          )}
        </FormCard>

        {/* 4 — AI Analysis */}
        <FormCard
          num="4"
          title="AI Analysis"
          desc="Layer AI-powered visual analysis on top of the rule-based engine."
        >
          <div className="flex items-center justify-between rounded-[11px] border border-border bg-background px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <Sparkles
                className={cn(
                  "size-[18px]",
                  aiEnabled ? "text-primary" : "text-muted-foreground"
                )}
              />
              <div>
                <Label
                  htmlFor="ai-toggle"
                  className="text-[13.5px] font-bold text-foreground"
                >
                  Enable AI analysis
                </Label>
                <p className="text-xs leading-snug text-muted-foreground">
                  Rule-based checks always run; AI is optional.
                </p>
              </div>
            </div>
            <Switch
              id="ai-toggle"
              checked={aiEnabled}
              onCheckedChange={(checked) => setAiEnabled(checked)}
            />
          </div>

          {aiEnabled && (
            <div className="mt-3">
              <p className="mb-2 text-[12.5px] font-semibold text-[var(--ink-2)]">
                Provider
              </p>
              <Segmented<AiProvider>
                value={aiProvider}
                onChange={setAiProvider}
                options={[
                  { value: "claude", label: "Claude (Anthropic)" },
                  { value: "openai", label: "GPT-4o (OpenAI)" },
                ]}
              />
            </div>
          )}
        </FormCard>
      </div>

      {/* Right column — sticky run summary */}
      <div className="lg:sticky lg:top-[92px]">
        <Card className="gap-0 px-5 py-5">
          <h3 className="text-base leading-tight">Run summary</h3>
          <div className="mt-4 flex flex-col gap-3">
            <SummaryRow
              icon={Globe}
              label="Target"
              value={url ? url.replace(/^https?:\/\//, "") : "Not set"}
              dim={!url}
            />
            <SummaryRow icon={Monitor} label="Engine" value={engineLabel} />
            <SummaryRow
              icon={Smartphone}
              label="Viewports"
              value={`${selectedDevices.length} selected`}
            />
            <SummaryRow
              icon={Sparkles}
              label="AI analysis"
              value={
                aiEnabled ? (aiProvider === "claude" ? "Claude" : "GPT-4o") : "Off"
              }
            />
          </div>

          <div className="my-4 h-px bg-border" />

          <div className="mb-3.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Clock className="size-3.5" />
            Est. ~{estimatedMinutes} min · {selectedDevices.length} captures
          </div>

          {submitError && (
            <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting || !url || selectedDevices.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Scan...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Start Scan
              </>
            )}
          </Button>

          <p className="mt-3 text-center text-[11.5px] leading-normal text-[var(--faint)]">
            Rule-based engine: axe-core, Lighthouse, HTMLHint &amp; CSS
            analyzer.
          </p>
        </Card>
      </div>
    </form>
  );
}
