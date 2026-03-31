import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";

export default function SettingsPage() {
  const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
  const openaiConfigured = !!process.env.OPENAI_API_KEY;

  return (
    <>
      <SiteHeader title="Settings" />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>AI Providers</CardTitle>
              <CardDescription>
                Configure API keys for AI-powered audit analysis. Set these in your <code className="text-sm bg-muted px-1 py-0.5 rounded">.env</code> file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">Anthropic (Claude)</p>
                  <p className="text-sm text-muted-foreground">
                    Uses Claude's vision API for visual analysis
                  </p>
                </div>
                <Badge variant={anthropicConfigured ? "default" : "secondary"}>
                  {anthropicConfigured ? "Configured" : "Not configured"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">OpenAI (GPT-4o)</p>
                  <p className="text-sm text-muted-foreground">
                    Uses GPT-4o vision for visual analysis
                  </p>
                </div>
                <Badge variant={openaiConfigured ? "default" : "secondary"}>
                  {openaiConfigured ? "Configured" : "Not configured"}
                </Badge>
              </div>

              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How to configure</p>
                <p>
                  Add your API keys to the <code className="bg-background px-1 py-0.5 rounded">.env</code> file:
                </p>
                <pre className="mt-2 bg-background p-3 rounded text-xs overflow-x-auto">
{`ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...`}
                </pre>
                <p className="mt-2">
                  Then restart the application. At least one provider must be configured to use AI-powered audits.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
