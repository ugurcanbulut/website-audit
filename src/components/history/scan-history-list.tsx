"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  Trash2,
  Search,
  Monitor,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SCAN_STATUS_CONFIG, getGradeColor } from "@/lib/ui-constants";

interface Scan {
  id: string;
  url: string;
  status: string;
  overallScore: number | null;
  overallGrade: string | null;
  browserEngine: string | null;
  createdAt: Date;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ...SCAN_STATUS_CONFIG,
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "scanning":
    case "auditing":
    case "analyzing":
      return <Loader2 className="size-3 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="size-3" />;
    case "failed":
      return <AlertCircle className="size-3" />;
    case "cancelled":
      return <Ban className="size-3" />;
    default:
      return <Clock className="size-3" />;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function DeleteButton({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this scan?")) return;

    setDeleting(true);
    try {
      await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
      toast.success("Scan deleted successfully");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={deleting}
      aria-label="Delete scan"
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export function ScanHistoryList({ scans }: { scans: Scan[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = scans.filter(
    (s) =>
      s.url.toLowerCase().includes(search.toLowerCase()) ||
      getHostname(s.url).toLowerCase().includes(search.toLowerCase())
  );

  if (scans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Monitor className="size-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-base mb-4">No scans yet</p>
        <Button render={<Link href="/scan/new" />}>
          <Plus className="size-4 mr-2" />
          Start a New Scan
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by URL..."
          className="pl-8"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-2 pr-4 text-left font-medium">Site</th>
              <th className="pb-2 pr-4 text-left font-medium">Status</th>
              <th className="pb-2 pr-4 text-left font-medium hidden sm:table-cell">Score</th>
              <th className="pb-2 pr-4 text-left font-medium hidden sm:table-cell">Engine</th>
              <th className="pb-2 pr-4 text-left font-medium hidden sm:table-cell">Date</th>
              <th className="pb-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((scan) => {
              const config = statusConfig[scan.status] ?? statusConfig.pending;
              return (
                <tr
                  key={scan.id}
                  className="group border-b last:border-0 cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/scan/${scan.id}`)}
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium">
                      {getHostname(scan.url)}
                    </span>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                      {scan.url}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={config.variant} className="gap-1">
                      <StatusIcon status={scan.status} />
                      {config.label}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 hidden sm:table-cell">
                    {scan.status === "completed" &&
                    scan.overallScore !== null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums font-medium">
                          {scan.overallScore}
                        </span>
                        {scan.overallGrade && (
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              getGradeColor(scan.overallGrade)
                            )}
                          >
                            {scan.overallGrade}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 capitalize text-muted-foreground hidden sm:table-cell">
                    {scan.browserEngine ?? "--"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground hidden sm:table-cell">
                    {formatDate(scan.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <DeleteButton scanId={scan.id} />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No scans matching &ldquo;{search}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
