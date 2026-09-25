import type {
  FieldRecord,
  OptimizationConstraints,
  Simulation,
} from '@/api/types'
import {
  formatFieldCount,
  formatWholeNumber,
  isFieldCalculated,
} from '@/lib/field-domain'

export const MAX_COMPARED_SIMULATIONS = 3

export const parseComparisonIds = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')

export const resolveComparisonIds = (
  requested: string[],
  selectable: ReadonlySet<string>,
): string[] => {
  const ids: string[] = []
  for (const id of requested) {
    if (ids.length === MAX_COMPARED_SIMULATIONS) break
    if (selectable.has(id) && !ids.includes(id)) ids.push(id)
  }
  return ids
}

const createdAtTime = (simulation: Pick<Simulation, 'createdAt'>): number =>
  Date.parse(simulation.createdAt) || 0

export const defaultComparisonIds = (
  simulations: Pick<Simulation, 'id' | 'createdAt'>[],
  selectable: ReadonlySet<string>,
): string[] =>
  simulations
    .filter((simulation) => selectable.has(simulation.id))
    .sort((left, right) => createdAtTime(right) - createdAtTime(left))
    .slice(0, MAX_COMPARED_SIMULATIONS)
    .map((simulation) => simulation.id)

export const toggleComparisonId = (ids: string[], id: string): string[] => {
  if (ids.includes(id)) return ids.filter((selected) => selected !== id)
  return ids.length < MAX_COMPARED_SIMULATIONS ? [...ids, id] : ids
}

export type ComparisonAvailability =
  | { kind: 'ready' }
  | { kind: 'uncalculated' }
  | { kind: 'partial'; missingCount: number }

export const comparisonAvailability = (
  fields: FieldRecord[],
): ComparisonAvailability => {
  const missingCount = fields.filter(
    (field) => !isFieldCalculated(field, true),
  ).length
  if (missingCount === fields.length) return { kind: 'uncalculated' }
  if (missingCount > 0) return { kind: 'partial', missingCount }
  return { kind: 'ready' }
}

export const describeComparisonAvailability = (
  availability: ComparisonAvailability,
): string | null => {
  if (availability.kind === 'uncalculated') return 'Ikke beregnet'
  if (availability.kind === 'partial') {
    return `${formatFieldCount(availability.missingCount)} ikke beregnet`
  }
  return null
}

export type BestDirection = 'highest' | 'lowest'

export const bestColumnIndex = (
  values: (number | null)[],
  direction: BestDirection,
  format: (value: number) => string,
): number | null => {
  const present = values.flatMap((value, index) =>
    value === null ? [] : [{ value, index }],
  )
  if (present.length < 2) return null
  const best = present.reduce((winner, candidate) => {
    const better =
      direction === 'highest'
        ? candidate.value > winner.value
        : candidate.value < winner.value
    return better ? candidate : winner
  })
  const bestText = format(best.value)
  const ties = present.filter((entry) => format(entry.value) === bestText)
  return ties.length === 1 ? best.index : null
}

export const formatKgN = (value: number): string =>
  `${formatWholeNumber(value)} kg N`

export const formatFeedUnits = (value: number): string =>
  `${formatWholeNumber(value)} FE`

export const describeFeedUnitRequirement = ({
  minFeedUnits,
  maxFeedUnits,
}: Pick<OptimizationConstraints, 'minFeedUnits' | 'maxFeedUnits'>):
  | string
  | null => {
  if (minFeedUnits !== null && maxFeedUnits !== null) {
    return `Krav ${formatWholeNumber(minFeedUnits)}-${formatFeedUnits(maxFeedUnits)}`
  }
  if (minFeedUnits !== null) {
    return `Krav mindst ${formatFeedUnits(minFeedUnits)}`
  }
  if (maxFeedUnits !== null) {
    return `Krav højst ${formatFeedUnits(maxFeedUnits)}`
  }
  return null
}

export type FeedUnitRequirementPlacement = {
  label: string | null
  cells: (string | null)[]
}

export const placeFeedUnitRequirements = (
  requirements: (string | null)[],
): FeedUnitRequirementPlacement => {
  const distinct = [
    ...new Set(
      requirements.filter(
        (requirement): requirement is string => requirement !== null,
      ),
    ),
  ]
  if (distinct.length > 1) return { label: null, cells: requirements }
  return {
    label: distinct.length === 1 ? distinct[0] : null,
    cells: requirements.map(() => null),
  }
}
