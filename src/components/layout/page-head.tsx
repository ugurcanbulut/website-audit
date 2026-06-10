import type { LucideIcon } from "lucide-react";

interface PageHeadProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

// Direction D page header: brand-soft icon tile + display title + muted
// subtitle, with an optional primary action pinned to the right.
export function PageHead({ icon: Icon, title, subtitle, right }: PageHeadProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex items-center gap-3.5">
        <div className="flex size-[46px] shrink-0 items-center justify-center rounded-[13px] bg-[var(--brand-soft)]">
          <Icon className="size-[23px] text-primary" strokeWidth={1.9} />
        </div>
        <div>
          <h1 className="text-[28px] leading-none">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}
