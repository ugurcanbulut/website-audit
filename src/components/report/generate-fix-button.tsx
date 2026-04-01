"use client";

import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateFixButtonProps {
  issueId: string;
  onFixGenerated?: (fix: {
    before: string;
    after: string;
    explanation: string;
  }) => void;
}

export function GenerateFixButton({
  issueId,
  onFixGenerated,
}: GenerateFixButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    fixedHtml: string;
    explanation: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to generate fix");
        return;
      }
      const data = await res.json();
      setResult(data);
      onFixGenerated?.({
        before: "",
        after: data.fixedHtml,
        explanation: data.explanation,
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-md border overflow-hidden">
        <div className="px-3 py-1.5 bg-muted text-base font-medium border-b flex items-center gap-2">
          <Wand2 className="size-3.5 text-primary" />
          AI-Generated Fix
        </div>
        <div className="p-3 space-y-2">
          <pre className="text-sm font-mono bg-green-50 dark:bg-green-950/20 p-2 rounded whitespace-pre-wrap break-all border border-green-200 dark:border-green-800">
            {result.fixedHtml}
          </pre>
          <p className="text-sm text-muted-foreground">
            {result.explanation}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="size-3.5 mr-1.5" />
            Generate Fix
          </>
        )}
      </Button>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}
