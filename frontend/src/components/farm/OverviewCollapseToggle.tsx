import { ChevronDown, ChevronUp } from 'lucide-react'

type OverviewCollapseToggleProps = {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  controls: string
}

export const OverviewCollapseToggle = ({
  collapsed,
  onCollapsedChange,
  controls,
}: OverviewCollapseToggleProps) => {
  const Icon = collapsed ? ChevronDown : ChevronUp

  return (
    <div className="relative -my-1 h-4 shrink-0">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-px bg-border"
      />
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={controls}
          onClick={() => onCollapsedChange(!collapsed)}
          className="inline-flex h-5 cursor-pointer items-center gap-1 rounded-full border bg-card px-2.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {collapsed ? 'Vis årsgennemgang' : 'Skjul årsgennemgang'}
        </button>
      </span>
    </div>
  )
}
