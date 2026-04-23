"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface DeleteScanButtonProps {
  scanId: string;
}

export function DeleteScanButton({ scanId }: DeleteScanButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function performDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Scan deleted");
        router.push("/");
      } else {
        toast.error("Failed to delete scan");
      }
    } catch {
      toast.error("Failed to delete scan");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" disabled={isDeleting}>
          <Trash2 className="h-4 w-4 mr-1" />
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      }
      title="Delete this scan?"
      description="This permanently removes the scan, its screenshots, findings, and any AI analysis. This action cannot be undone."
      confirmLabel="Delete"
      confirmVariant="destructive"
      onConfirm={performDelete}
    />
  );
}
