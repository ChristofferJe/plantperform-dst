import { describe, expect, it } from 'vitest'

import type { FieldRecord, RotationYear } from '@/api/types'
import {
  cropAreaLimitError,
  cropAreaLimitFromDraft,
  cropAreaLimitWarning,
  cropAreaViolationsFromDetail,
  currentCropArea,
  currentCropAreaLabel,
  draftFromCropAreaLimit,
  emptyCropAreaLimitDraft,
  fieldAreaSums,
  hectaresToPercent,
  percentRangeLabel,
  sameCropAreaLimits,
  totalFieldAreaHa,
  withHectares,
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
  })

  it('rounds percent to one decimal', () => {
    expect(hectaresToPercent(10, 30)).toBe(33.3)
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

  it('clears the percent when the hectares are cleared', () => {
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
    const typed = withHectares(
      emptyCropAreaLimitDraft(POTATOES),
      'min',
      '20',
      80,
    )
    expect(cropAreaLimitFromDraft(typed)).toEqual({
      cropCode: POTATOES,
      minAreaHa: 20,
      maxAreaHa: null,
    })
  })
})

describe('percentRangeLabel', () => {
  it('describes the range in percent of the area', () => {
    const both = withHectares(
      withHectares(emptyCropAreaLimitDraft(POTATOES), 'min', '0.4', 39.29),
      'max',
      '15',
      39.29,
    )
    expect(percentRangeLabel(both)).toBe('1–38,2 % af arealet')
    expect(percentRangeLabel({ ...both, maxHa: '', maxPct: '' })).toBe(
      'Mindst 1 % af arealet',
    )
    expect(percentRangeLabel({ ...both, minHa: '', minPct: '' })).toBe(
      'Højst 38,2 % af arealet',
    )
    expect(percentRangeLabel(emptyCropAreaLimitDraft(POTATOES))).toBeNull()
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

const year = (cropCode: number): RotationYear => ({
  cropCode,
  cropName: String(cropCode),
  undersownCropCode: null,
  undersownCropName: null,
})

const field = (areaHa: number, codes: number[] = []) =>
  ({ areaHa, cropRotation: codes.map(year) }) as FieldRecord

describe('currentCropArea', () => {
  it('repeats each rotation through the eight planning years', () => {
    const fields = [
      field(10, [POTATOES, 1]),
      field(20, [2, POTATOES, 2]),
      field(5),
    ]
    expect(currentCropArea(fields, POTATOES)).toEqual({
      averageHa: 12.5,
      minYearHa: 0,
      maxYearHa: 30,
    })
  })

  it('describes the average and the range per year', () => {
    expect(
      currentCropAreaLabel({ averageHa: 12.5, minYearHa: 0, maxYearHa: 30 }),
    ).toBe('Nu: 12,5 ha i gns. (0–30 ha pr. år)')
    expect(
      currentCropAreaLabel({ averageHa: 20, minYearHa: 20, maxYearHa: 20 }),
    ).toBe('Nu: 20 ha hvert år')
    expect(
      currentCropAreaLabel({ averageHa: 0, minYearHa: 0, maxYearHa: 0 }),
    ).toBe('Nu: ingen')
  })
})

describe('cropAreaLimitWarning', () => {
  const fields = [field(12), field(17), field(25)]
  const sums = fieldAreaSums(fields)

  it('warns when no whole fields add up to the range', () => {
    expect(
      cropAreaLimitWarning(draft({ minHa: '20', maxHa: '22' }), 54, sums),
    ).toBe(
      'Ingen kombination af hele marker giver mellem 20 og 22 ha, så ' +
        'års-optimeringen kan ikke opfylde kravet. Gør spændet større.',
    )
  })

  it('accepts a range that whole fields can hit', () => {
    expect(
      cropAreaLimitWarning(draft({ minHa: '28', maxHa: '30' }), 54, sums),
    ).toBeNull()
    expect(
      cropAreaLimitWarning(draft({ minHa: '12', maxHa: '12' }), 54, sums),
    ).toBeNull()
  })

  it('warns when the minimum is above the total area', () => {
    expect(cropAreaLimitWarning(draft({ minHa: '60' }), 54, sums)).toBe(
      'Minimum er større end simuleringens samlede areal på 54 ha.',
    )
  })

  it('leaves invalid rows to the error', () => {
    expect(
      cropAreaLimitWarning(draft({ minHa: '30', maxHa: '20' }), 54, sums),
    ).toBeNull()
  })
})
