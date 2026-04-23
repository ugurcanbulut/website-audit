"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteScanInline({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function performDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Scan deleted");
        router.refresh();
      } else {
        toast.error("Failed to delete scan");
      }
    } catch {
      toast.error("Failed to delete scan");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          disabled={deleting}
          aria-label="Delete scan"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      }
      title="Delete scan?"
      description="This permanently removes the scan, its screenshots, and all findings. This action cannot be undone."
      confirmLabel={deleting ? "Deleting..." : "Delete"}
      confirmVariant="destructive"
      onConfirm={performDelete}
    />
  );
}
