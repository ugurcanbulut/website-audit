import { ChevronRight } from "lucide-react"
import Link from "next/link"

interface Breadcrumb {
  label: string
  href?: string
}

interface SiteHeaderProps {
  title?: string
  breadcrumbs?: Breadcrumb[]
}

// Direction D: primary navigation lives in the top nav; this strip only
// carries the page's breadcrumb trail (or title) inside the content column.
export function SiteHeader({ title = "Dashboard", breadcrumbs }: SiteHeaderProps) {
  return (
    <div className="flex items-center px-4 pt-6 lg:px-6">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="flex flex-wrap items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 text-[var(--faint)]" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-bold text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : (
        <span className="text-[13px] font-bold text-foreground">{title}</span>
      )}
    </div>
  )
}
