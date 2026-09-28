import { describe, expect, it } from 'vitest'

import type { FieldRecord } from '@/api/types'
import { emptyMeasures } from '@/lib/field-domain'
import { compareFields } from '@/lib/field-sort'

const field = (id: string, areaHa: number, db2: number): FieldRecord => ({
  id,
  farmId: 'farm',
  imkId: null,
  catchmentId: 7,
  retention: null,
  soilTypeNumber: null,
  cropRotation: [],
  rotationId: 'r1',
  measures: emptyMeasures(),
  allowedRotationIds: [],
  db2,
  nLoad: 0,
  leaching: 0,
  feedUnits: 0,
  name: id,
  areaHa,
  inTakeoutPlan: '',
  nLoadLimitKgNHa: 0,
  nLoadQuotaKgN: 0,
  quotaEligible: true,
  geometry: null,
})

describe('compareFields', () => {
  it('sorts the figures by their value per hectare', () => {
    const small = field('small', 1, 100)
    const large = field('large', 10, 500)
    const sorted = [large, small].sort((left, right) =>
      compareFields(left, right, { key: 'db2', direction: 'desc' }),
    )
    expect(sorted.map(({ id }) => id)).toEqual(['small', 'large'])
  })
})
