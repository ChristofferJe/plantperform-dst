import { describe, expect, it } from 'vitest'

import type { FieldRecord } from '@/api/types'
import {
  cropAreaLimitError,
  cropAreaLimitFromDraft,
  cropAreaViolationsFromDetail,
  draftFromCropAreaLimit,
  emptyCropAreaLimitDraft,
  hectaresToPercent,
  percentToHectares,
  sameCropAreaLimits,
  totalFieldAreaHa,
  withHectares,
  withPercent,
  type CropAreaLimitDraft,
} from '@/lib/crop-area-limits'

const POTATOES = 150

const draft = (values: Partial<CropAreaLimitDraft>): CropAreaLimitDraft => ({
  ...emptyCropAreaLimitDraft(POTATOES),
  ...values,
})

describe('totalFieldAreaHa', () => {
  it('adds up the area of the fields', () => {
    const fields = [{ areaHa: 50 }, { areaHa: 30 }] as FieldRecord[]
    expect(totalFieldAreaHa(fields)).toBe(80)
  })
})

describe('hectares and percent', () => {
  it('gives 20 ha as 25 % of 80 ha', () => {
    expect(hectaresToPercent(20, 80)).toBe(25)
    expect(percentToHectares(25, 80)).toBe(20)
  })

  it('rounds percent to one decimal and hectares to two', () => {
    expect(hectaresToPercent(10, 30)).toBe(33.3)
    expect(percentToHectares(33.3, 30.5)).toBe(10.16)
  })

  it('has no percent when the simulation has no area', () => {
    expect(hectaresToPercent(20, 0)).toBeNull()
  })

  it('works out the percent when the user types hectares', () => {
    const next = withHectares(
      emptyCropAreaLimitDraft(POTATOES),
      'min',
      '20',
      80,
    )
    expect(next).toMatchObject({ minHa: '20', minPct: '25', maxHa: '' })
  })

  it('works out the hectares when the user types a percent', () => {
    const next = withPercent(emptyCropAreaLimitDraft(POTATOES), 'max', '50', 80)
    expect(next).toMatchObject({ maxPct: '50', maxHa: '40', minHa: '' })
  })

  it('clears the other field when the typed one is cleared', () => {
    const filled = withHectares(
      emptyCropAreaLimitDraft(POTATOES),
      'min',
      '20',
      80,
    )
    expect(withHectares(filled, 'min', '', 80)).toMatchObject({
      minHa: '',
      minPct: '',
    })
  })

  it('fills the percentages of a saved limit from its hectares', () => {
    expect(
      draftFromCropAreaLimit(
        { cropCode: POTATOES, minAreaHa: 20, maxAreaHa: null },
        80,
      ),
    ).toEqual({
      cropCode: POTATOES,
      minHa: '20',
      maxHa: '',
      minPct: '25',
      maxPct: '',
    })
  })

  it('saves the limit in hectares', () => {
    const typed = withPercent(
      emptyCropAreaLimitDraft(POTATOES),
      'min',
      '25',
      80,
    )
    expect(cropAreaLimitFromDraft(typed)).toEqual({
      cropCode: POTATOES,
      minAreaHa: 20,
      maxAreaHa: null,
    })
  })
})

describe('cropAreaLimitError', () => {
  it('accepts min alone, max alone, and min equal to max', () => {
    expect(cropAreaLimitError(draft({ minHa: '20' }))).toBeNull()
    expect(cropAreaLimitError(draft({ maxHa: '20' }))).toBeNull()
    expect(cropAreaLimitError(draft({ minHa: '20', maxHa: '20' }))).toBeNull()
  })

  it('rejects a minimum above the maximum', () => {
    expect(cropAreaLimitError(draft({ minHa: '30', maxHa: '20' }))).toBe(
      'Minimum må ikke være større end maksimum.',
    )
  })

  it('compares the bounds as numbers, not text', () => {
    expect(cropAreaLimitError(draft({ minHa: '9', maxHa: '10' }))).toBeNull()
  })

  it('needs at least one bound', () => {
    expect(cropAreaLimitError(draft({}))).toBe(
      'Angiv et minimum eller et maksimum.',
    )
  })

  it('rejects negative areas', () => {
    expect(cropAreaLimitError(draft({ minHa: '-1' }))).toBe(
      'Arealet kan ikke være negativt.',
    )
  })
})

describe('sameCropAreaLimits', () => {
  const limit = { cropCode: POTATOES, minAreaHa: 20, maxAreaHa: null }

  it('sees equal limits as unchanged', () => {
    expect(sameCropAreaLimits([limit], [{ ...limit }])).toBe(true)
  })

  it('sees a changed bound or a removed limit as a change', () => {
    expect(sameCropAreaLimits([limit], [{ ...limit, maxAreaHa: 30 }])).toBe(
      false,
    )
    expect(sameCropAreaLimits([], [limit])).toBe(false)
  })
})

describe('cropAreaViolationsFromDetail', () => {
  it('reads the crop codes and years of an infeasible run', () => {
    expect(
      cropAreaViolationsFromDetail({
        message: 'Kravene kan ikke opfyldes',
        cropAreaViolations: [
          { cropCode: POTATOES, years: [2027, 2029] },
          { cropCode: 1, years: [] },
        ],
      }),
    ).toEqual([
      { cropCode: POTATOES, years: [2027, 2029] },
      { cropCode: 1, years: [] },
    ])
  })

  it('finds none in a plain error message', () => {
    expect(cropAreaViolationsFromDetail('Simulering ikke fundet')).toEqual([])
    expect(cropAreaViolationsFromDetail(undefined)).toEqual([])
  })
})
