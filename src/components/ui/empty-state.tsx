import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="relative mb-4">
        {/* Decorative rings behind icon */}
        <div className="absolute inset-0 -m-4 rounded-full bg-primary/5 animate-pulse" />
        <div className="absolute inset-0 -m-2 rounded-full bg-primary/10" />
        <div className="relative rounded-full bg-muted p-4">
          <Icon className="size-8 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
