import { Settings, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { cn } from "@/lib/utils";

function ProviderRow({
  name,
  description,
  configured,
}: {
  name: string;
  description: string;
  configured: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-2)]">
          <Sparkles className="size-[18px] text-muted-foreground" strokeWidth={1.9} />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">{name}</div>
          <div className="text-[12.5px] text-muted-foreground">{description}</div>
        </div>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold",
          configured
            ? "bg-emerald-50 text-emerald-700"
            : "bg-[var(--surface-2)] text-muted-foreground"
        )}
      >
        <span
          className={cn(
            "size-[7px] rounded-full",
            configured ? "bg-emerald-500" : "bg-[var(--faint)]"
          )}
        />
        {configured ? "Configured" : "Not configured"}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
  const openaiConfigured = !!process.env.OPENAI_API_KEY;

  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Settings" },
      ]} />
      <div className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
          <PageHead
            icon={Settings}
            title="Settings"
            subtitle="Configure providers for AI-powered audit analysis."
          />
          <Card className="gap-0 rounded-2xl py-0 shadow-none">
            <div className="p-5 sm:p-6">
              <h2 className="text-base">AI Providers</h2>
              <p className="mb-4.5 mt-1.5 text-[13px] leading-normal text-muted-foreground">
                Set API keys in your{" "}
                <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-xs">
                  .env
                </code>{" "}
                file. At least one provider must be configured to enable AI
                analysis.
              </p>
              <div className="flex flex-col gap-2.5">
                <ProviderRow
                  name="Anthropic (Claude)"
                  description="Uses Claude's vision API for visual analysis"
                  configured={anthropicConfigured}
                />
                <ProviderRow
                  name="OpenAI (GPT-5)"
                  description="Uses GPT-5 vision for visual analysis"
                  configured={openaiConfigured}
                />
              </div>
              <div className="mt-4 rounded-xl bg-muted p-4">
                <div className="mb-2 text-[13.5px] font-bold text-foreground">
                  How to configure
                </div>
                <pre className="overflow-x-auto rounded-lg border bg-background px-3.5 py-3 font-mono text-xs leading-relaxed text-[var(--ink-2)]">
{`ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...`}
                </pre>
                <p className="mt-2.5 text-[12.5px] leading-normal text-muted-foreground">
                  Then restart the application. Rule-based checks always run
                  regardless of AI configuration.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
