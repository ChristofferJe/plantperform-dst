import type { ReactNode } from 'react'

import { TableCell, TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type ComparisonRowHeaderProps = {
  children: ReactNode
  note?: string | null
}

export const ComparisonRowHeader = ({
  children,
  note,
}: ComparisonRowHeaderProps) => (
  <TableHead
    scope="row"
    className="sticky left-0 z-10 h-auto min-w-48 bg-card px-4 py-3 align-top font-normal whitespace-normal"
  >
    <span className="flex items-center gap-1 font-medium">{children}</span>
    {note ? (
      <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>
    ) : null}
  </TableHead>
)

type ComparisonCellProps = {
  children?: ReactNode
}

export const ComparisonCell = ({ children }: ComparisonCellProps) => (
  <TableCell className="min-w-44 px-4 py-3 align-top whitespace-normal">
    {children}
  </TableCell>
)

type ComparisonValueProps = {
  text: string
  best: boolean
}

export const ComparisonValue = ({ text, best }: ComparisonValueProps) => (
  <span
    className={cn(
      'font-display text-xl tabular-nums',
      best && 'text-green-700',
    )}
  >
    {text}
    {best ? <span className="sr-only"> (bedst)</span> : null}
  </span>
)
