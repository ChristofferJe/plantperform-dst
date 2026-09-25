import { describe, expect, it } from 'vitest'

import type { FieldRecord } from '@/api/types'
import { emptyMeasures, formatCompactDkk } from '@/lib/field-domain'
import {
  bestColumnIndex,
  comparisonAvailability,
  defaultComparisonIds,
  describeComparisonAvailability,
  describeFeedUnitRequirement,
  formatFeedUnits,
  formatKgN,
  parseComparisonIds,
  placeFeedUnitRequirements,
  resolveComparisonIds,
  toggleComparisonId,
} from '@/lib/simulation-comparison'

const field = (id: string, rotationId: string | null): FieldRecord => ({
  id,
  farmId: 'farm',
  imkId: null,
  catchmentId: 7,
  retention: null,
  soilTypeNumber: null,
  cropRotation: [],
  rotationId,
  measures: emptyMeasures(),
  allowedRotationIds: [],
  db2: 0,
  nLoad: 0,
  leaching: 0,
  feedUnits: 0,
  name: id,
  areaHa: 1,
  inTakeoutPlan: '',
  nLoadLimitKgNHa: 0,
  nLoadQuotaKgN: 0,
  quotaEligible: true,
  geometry: null,
})

describe('parseComparisonIds', () => {
  it('reads comma separated ids and skips empty entries', () => {
    expect(parseComparisonIds(' a,b,,c ')).toEqual(['a', 'b', 'c'])
  })

  it('reads a missing parameter as no ids', () => {
    expect(parseComparisonIds(null)).toEqual([])
  })
})

describe('resolveComparisonIds', () => {
  it('keeps selectable ids in order without duplicates, at most three', () => {
    expect(
      resolveComparisonIds(
        ['unknown', 'a', 'a', 'b', 'c', 'd'],
        new Set(['a', 'b', 'c', 'd']),
      ),
    ).toEqual(['a', 'b', 'c'])
  })
})

describe('defaultComparisonIds', () => {
  it('picks the newest selectable simulations, at most three', () => {
    const simulations = [
      { id: 'oldest', createdAt: '2026-09-01T08:00:00Z' },
      { id: 'newest', createdAt: '2026-09-24T08:00:00Z' },
      { id: 'not-calculated', createdAt: '2026-09-25T08:00:00Z' },
      { id: 'middle', createdAt: '2026-09-10T08:00:00Z' },
      { id: 'newer', createdAt: '2026-09-20T08:00:00Z' },
    ]
    expect(
      defaultComparisonIds(
        simulations,
        new Set(['oldest', 'newest', 'middle', 'newer']),
      ),
    ).toEqual(['newest', 'newer', 'middle'])
  })
})

describe('toggleComparisonId', () => {
  it('adds an id at the end', () => {
    expect(toggleComparisonId(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('removes a chosen id', () => {
    expect(toggleComparisonId(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('adds nothing when three are chosen', () => {
    expect(toggleComparisonId(['a', 'b', 'c'], 'd')).toEqual(['a', 'b', 'c'])
  })
})

describe('comparisonAvailability', () => {
  it('is ready when every field is calculated', () => {
    expect(
      comparisonAvailability([field('1', 'r1'), field('2', 'r2')]),
    ).toEqual({ kind: 'ready' })
  })

  it('counts the fields that are not calculated', () => {
    expect(
      comparisonAvailability([
        field('1', 'r1'),
        field('2', null),
        field('3', null),
      ]),
    ).toEqual({ kind: 'partial', missingCount: 2 })
  })

  it('is not calculated when no field is', () => {
    expect(comparisonAvailability([field('1', null)])).toEqual({
      kind: 'uncalculated',
    })
    expect(comparisonAvailability([])).toEqual({ kind: 'uncalculated' })
  })
})

describe('describeComparisonAvailability', () => {
  it('says why a simulation cannot be chosen', () => {
    expect(describeComparisonAvailability({ kind: 'uncalculated' })).toBe(
      'Ikke beregnet',
    )
    expect(
      describeComparisonAvailability({ kind: 'partial', missingCount: 1 }),
    ).toBe('1 mark ikke beregnet')
    expect(
      describeComparisonAvailability({ kind: 'partial', missingCount: 3 }),
    ).toBe('3 marker ikke beregnet')
    expect(describeComparisonAvailability({ kind: 'ready' })).toBeNull()
  })
})

describe('bestColumnIndex', () => {
  it('finds the highest value', () => {
    expect(bestColumnIndex([100, 300, 200], 'highest', formatKgN)).toBe(1)
  })

  it('finds the lowest value', () => {
    expect(bestColumnIndex([100, 300, 200], 'lowest', formatKgN)).toBe(0)
  })

  it('marks nothing when the best values look the same', () => {
    expect(
      bestColumnIndex(
        [1_240_000, 1_210_000, 900_000],
        'highest',
        formatCompactDkk,
      ),
    ).toBeNull()
  })

  it('leaves out columns without a value', () => {
    expect(bestColumnIndex([null, 5, 7], 'lowest', formatKgN)).toBe(1)
  })

  it('marks nothing with fewer than two values', () => {
    expect(bestColumnIndex([null, 5], 'lowest', formatKgN)).toBeNull()
  })
})

describe('describeFeedUnitRequirement', () => {
  it('describes a minimum, a maximum and both', () => {
    expect(
      describeFeedUnitRequirement({
        minFeedUnits: 230_000,
        maxFeedUnits: null,
      }),
    ).toBe('Krav mindst 230.000 FE')
    expect(
      describeFeedUnitRequirement({
        minFeedUnits: null,
        maxFeedUnits: 250_000,
      }),
    ).toBe('Krav højst 250.000 FE')
    expect(
      describeFeedUnitRequirement({
        minFeedUnits: 200_000,
        maxFeedUnits: 250_000,
      }),
    ).toBe('Krav 200.000-250.000 FE')
  })

  it('has no text without a requirement', () => {
    expect(
      describeFeedUnitRequirement({ minFeedUnits: null, maxFeedUnits: null }),
    ).toBeNull()
  })
})

describe('placeFeedUnitRequirements', () => {
  it('puts a shared requirement under the row name', () => {
    const requirement = 'Krav mindst 230.000 FE'
    expect(
      placeFeedUnitRequirements([null, requirement, null, requirement]),
    ).toEqual({ label: requirement, cells: [null, null, null, null] })
  })

  it('puts different requirements under each cell', () => {
    expect(placeFeedUnitRequirements([null, 'A', 'B'])).toEqual({
      label: null,
      cells: [null, 'A', 'B'],
    })
  })

  it('has no text when no column has a requirement', () => {
    expect(placeFeedUnitRequirements([null, null])).toEqual({
      label: null,
      cells: [null, null],
    })
  })
})

describe('formatKgN and formatFeedUnits', () => {
  it('round to whole units with Danish thousands separators', () => {
    expect(formatKgN(1234.4)).toBe('1.234 kg N')
    expect(formatFeedUnits(230_000)).toBe('230.000 FE')
  })
})
