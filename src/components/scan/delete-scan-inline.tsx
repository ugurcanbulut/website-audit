"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeleteScanInline({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this scan?")) return;

    setDeleting(true);
    try {
      await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
      toast.success("Scan deleted");
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
