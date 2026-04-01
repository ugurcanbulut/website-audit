"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface DeleteScanButtonProps {
  scanId: string;
}

export function DeleteScanButton({ scanId }: DeleteScanButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this scan? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Scan deleted successfully");
        router.push("/");
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDelete}
      disabled={isDeleting}
    >
      <Trash2 className="h-4 w-4 mr-1" />
      {isDeleting ? "Deleting..." : "Delete"}
    </Button>
  );
}
