import type { CropAreaLimit, CropAreaRange, FieldRecord } from '@/api/types'
import { NUM_ROTATION_YEARS, ROTATION_CALENDAR_YEARS } from '@/lib/field-domain'

export type AreaBound = 'min' | 'max'

export type CropAreaLimitDraft = {
  cropCode: number
  minHa: string
  maxHa: string
  minPct: string
  maxPct: string
}

const PERCENT_DECIMALS = 1

const areaFormat = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const parseInput = (value: string): number | null => {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export const totalFieldAreaHa = (fields: FieldRecord[]) =>
  fields.reduce((total, field) => total + field.areaHa, 0)

export const hectaresToPercent = (areaHa: number, totalAreaHa: number) =>
  totalAreaHa > 0 ? round((areaHa / totalAreaHa) * 100, PERCENT_DECIMALS) : null

const hectaresInputToPercentInput = (value: string, totalAreaHa: number) => {
  const areaHa = parseInput(value)
  if (areaHa === null || Number.isNaN(areaHa)) return ''
  const percent = hectaresToPercent(areaHa, totalAreaHa)
  return percent === null ? '' : String(percent)
}

const hectaresKey = (bound: AreaBound) => (bound === 'min' ? 'minHa' : 'maxHa')
const percentKey = (bound: AreaBound) => (bound === 'min' ? 'minPct' : 'maxPct')

export const withHectares = (
  draft: CropAreaLimitDraft,
  bound: AreaBound,
  value: string,
  totalAreaHa: number,
): CropAreaLimitDraft => ({
  ...draft,
  [hectaresKey(bound)]: value,
  [percentKey(bound)]: hectaresInputToPercentInput(value, totalAreaHa),
})

const areaToInput = (value: number | null) =>
  value === null ? '' : String(value)

export const emptyCropAreaLimitDraft = (
  cropCode: number,
): CropAreaLimitDraft => ({
  cropCode,
  minHa: '',
  maxHa: '',
  minPct: '',
  maxPct: '',
})

export const draftFromCropAreaLimit = (
  limit: CropAreaLimit,
  totalAreaHa: number,
): CropAreaLimitDraft => {
  const minHa = areaToInput(limit.minAreaHa)
  const maxHa = areaToInput(limit.maxAreaHa)
  return {
    cropCode: limit.cropCode,
    minHa,
    maxHa,
    minPct: hectaresInputToPercentInput(minHa, totalAreaHa),
    maxPct: hectaresInputToPercentInput(maxHa, totalAreaHa),
  }
}

export const cropAreaLimitError = (
  draft: CropAreaLimitDraft,
): string | null => {
  const min = parseInput(draft.minHa)
  const max = parseInput(draft.maxHa)
  if (Number.isNaN(min) || Number.isNaN(max)) return 'Skriv et tal.'
  if (min === null && max === null) return 'Angiv et minimum eller et maksimum.'
  if ((min !== null && min < 0) || (max !== null && max < 0)) {
    return 'Arealet kan ikke være negativt.'
  }
  if (min !== null && max !== null && min > max) {
    return 'Minimum må ikke være større end maksimum.'
  }
  return null
}

export const cropAreaLimitFromDraft = (
  draft: CropAreaLimitDraft,
): CropAreaLimit => ({
  cropCode: draft.cropCode,
  minAreaHa: parseInput(draft.minHa),
  maxAreaHa: parseInput(draft.maxHa),
})

export const sameCropAreaLimits = (
  left: CropAreaLimit[],
  right: CropAreaLimit[],
) =>
  left.length === right.length &&
  left.every(
    (limit, index) =>
      limit.cropCode === right[index].cropCode &&
      limit.minAreaHa === right[index].minAreaHa &&
      limit.maxAreaHa === right[index].maxAreaHa,
  )

export const percentRangeLabel = (draft: CropAreaLimitDraft): string | null => {
  const min = parseInput(draft.minPct)
  const max = parseInput(draft.maxPct)
  const format = (value: number) => areaFormat.format(value)
  if (
    min !== null &&
    max !== null &&
    !Number.isNaN(min) &&
    !Number.isNaN(max)
  ) {
    return `${format(min)}–${format(max)} % af arealet`
  }
  if (min !== null && !Number.isNaN(min))
    return `Mindst ${format(min)} % af arealet`
  if (max !== null && !Number.isNaN(max))
    return `Højst ${format(max)} % af arealet`
  return null
}

export type CurrentCropArea = {
  averageHa: number
  minYearHa: number
  maxYearHa: number
}

export const currentCropArea = (
  fields: FieldRecord[],
  cropCode: number,
): CurrentCropArea => {
  const areaByYear = Array.from({ length: NUM_ROTATION_YEARS }, () => 0)
  for (const field of fields) {
    const rotation = field.cropRotation
    if (rotation.length === 0) continue
    areaByYear.forEach((_, year) => {
      if (rotation[year % rotation.length].cropCode === cropCode) {
        areaByYear[year] += field.areaHa
      }
    })
  }
  return {
    averageHa:
      areaByYear.reduce((total, area) => total + area, 0) / NUM_ROTATION_YEARS,
    minYearHa: Math.min(...areaByYear),
    maxYearHa: Math.max(...areaByYear),
  }
}

export const currentCropAreaLabel = (area: CurrentCropArea) => {
  const minYear = areaFormat.format(area.minYearHa)
  const maxYear = areaFormat.format(area.maxYearHa)
  if (area.maxYearHa === 0) return 'Nu: ingen'
  if (minYear === maxYear) return `Nu: ${maxYear} ha hvert år`
  return `Nu: ${areaFormat.format(area.averageHa)} ha i gns. (${minYear}–${maxYear} ha pr. år)`
}

export type FieldAreaSums = {
  reachable: Uint8Array
  toleranceUnits: number
}

const SUM_UNITS_PER_HA = 100
const MAX_SUM_WORK = 20_000_000

export const fieldAreaSums = (fields: FieldRecord[]): FieldAreaSums | null => {
  const units = fields
    .map((field) => Math.round(field.areaHa * SUM_UNITS_PER_HA))
    .filter((unit) => unit > 0)
  const totalUnits = units.reduce((total, unit) => total + unit, 0)
  if (totalUnits * units.length > MAX_SUM_WORK) return null
  const reachable = new Uint8Array(totalUnits + 1)
  reachable[0] = 1
  let reachedUnits = 0
  for (const unit of units) {
    for (let sum = reachedUnits; sum >= 0; sum--) {
      if (reachable[sum]) reachable[sum + unit] = 1
    }
    reachedUnits += unit
  }
  return { reachable, toleranceUnits: Math.ceil(units.length / 2) }
}

const hasSumBetween = (sums: FieldAreaSums, minHa: number, maxHa: number) => {
  const from = Math.max(
    0,
    Math.floor(minHa * SUM_UNITS_PER_HA) - sums.toleranceUnits,
  )
  const to = Math.min(
    sums.reachable.length - 1,
    Math.ceil(maxHa * SUM_UNITS_PER_HA) + sums.toleranceUnits,
  )
  for (let sum = from; sum <= to; sum++) {
    if (sums.reachable[sum]) return true
  }
  return false
}

export const cropAreaLimitWarning = (
  draft: CropAreaLimitDraft,
  totalAreaHa: number,
  sums: FieldAreaSums | null,
): string | null => {
  if (cropAreaLimitError(draft) !== null) return null
  const min = parseInput(draft.minHa)
  const max = parseInput(draft.maxHa)
  if (min !== null && min > totalAreaHa) {
    return `Minimum er større end simuleringens samlede areal på ${areaFormat.format(totalAreaHa)} ha.`
  }
  if (min === null || max === null || sums === null) return null
  if (hasSumBetween(sums, min, max)) return null
  return (
    `Ingen kombination af hele marker giver mellem ${areaFormat.format(min)} ` +
    `og ${areaFormat.format(max)} ha, så års-optimeringen kan ikke opfylde ` +
    'kravet. Gør spændet større.'
  )
}

export const formatAreaHa = (areaHa: number) => areaFormat.format(areaHa)

const RANGE_TOLERANCE_HA = 0.005

type RunBounds = {
  highestMinHa: number
  lowestMaxHa: number
  highestMinYears: number[]
  lowestMaxYears: number[]
}

const optimizeBounds = (range: CropAreaRange): RunBounds => ({
  highestMinHa: range.maxAverageHa,
  lowestMaxHa: range.minAverageHa,
  highestMinYears: [],
  lowestMaxYears: [],
})

const yearlyBounds = (range: CropAreaRange): RunBounds => {
  const weakestYearHa = Math.min(...range.maxHaByYear)
  const strongestFloorHa = Math.max(...range.minHaByYear)
  const yearsAt = (areaByYear: number[], area: number) =>
    ROTATION_CALENDAR_YEARS.filter(
      (_, year) =>
        Math.abs((areaByYear[year] ?? 0) - area) <= RANGE_TOLERANCE_HA,
    )
  return {
    highestMinHa: Math.min(weakestYearHa, range.yearlyMaxAverageHa),
    lowestMaxHa: strongestFloorHa,
    highestMinYears:
      weakestYearHa < range.yearlyMaxAverageHa
        ? yearsAt(range.maxHaByYear, weakestYearHa)
        : [],
    lowestMaxYears:
      strongestFloorHa > 0 ? yearsAt(range.minHaByYear, strongestFloorHa) : [],
  }
}

export type PossibleCropArea = {
  lowestMaxHa: number
  highestMinHa: number
}

export const possibleCropArea = (range: CropAreaRange): PossibleCropArea => {
  const optimize = optimizeBounds(range)
  const yearly = yearlyBounds(range)
  return {
    lowestMaxHa: Math.min(optimize.lowestMaxHa, yearly.lowestMaxHa),
    highestMinHa: Math.max(optimize.highestMinHa, yearly.highestMinHa),
  }
}

export const possibleCropAreaLabel = (possible: PossibleCropArea) =>
  `Muligt: ${areaFormat.format(possible.lowestMaxHa)}–${areaFormat.format(possible.highestMinHa)} ha`

const roundDown = (value: number) => Math.floor(value * 10 + 1e-9) / 10
const roundUp = (value: number) => Math.ceil(value * 10 - 1e-9) / 10

export type CropAreaRangeError = {
  message: string
  fix: { bound: AreaBound; areaHa: number; label: string }
}

export const cropAreaRangeError = (
  draft: CropAreaLimitDraft,
  range: CropAreaRange | undefined,
): CropAreaRangeError | null => {
  if (!range || cropAreaLimitError(draft) !== null) return null
  const possible = possibleCropArea(range)
  const min = parseInput(draft.minHa)
  const max = parseInput(draft.maxHa)
  if (min !== null && min > possible.highestMinHa + RANGE_TOLERANCE_HA) {
    const areaHa = roundDown(possible.highestMinHa)
    return {
      message:
        `Højst ${areaFormat.format(possible.highestMinHa)} ha er muligt med ` +
        'simuleringens sædskifter og låste marker.',
      fix: {
        bound: 'min',
        areaHa,
        label: `Brug ${areaFormat.format(areaHa)} ha`,
      },
    }
  }
  if (max !== null && max < possible.lowestMaxHa - RANGE_TOLERANCE_HA) {
    const areaHa = roundUp(possible.lowestMaxHa)
    return {
      message:
        `Mindst ${areaFormat.format(possible.lowestMaxHa)} ha ligger fast med ` +
        'simuleringens sædskifter og låste marker.',
      fix: {
        bound: 'max',
        areaHa,
        label: `Brug ${areaFormat.format(areaHa)} ha`,
      },
    }
  }
  return null
}

export const cropAreaRangeWarnings = (
  draft: CropAreaLimitDraft,
  range: CropAreaRange | undefined,
): string[] => {
  if (!range || cropAreaLimitError(draft) !== null) return []
  if (cropAreaRangeError(draft, range) !== null) return []
  const optimize = optimizeBounds(range)
  const yearly = yearlyBounds(range)
  const min = parseInput(draft.minHa)
  const max = parseInput(draft.maxHa)
  const warnings: string[] = []
  const inYears = (years: number[], fallback: string) =>
    years.length > 0 ? `i ${years.join(', ')}` : fallback

  if (min !== null) {
    if (min > optimize.highestMinHa + RANGE_TOLERANCE_HA) {
      warnings.push(
        'Kun Års-optimeringen kan opfylde minimum – Optimér kan højst nå ' +
          `${areaFormat.format(optimize.highestMinHa)} ha i gennemsnit.`,
      )
    }
    if (min > yearly.highestMinHa + RANGE_TOLERANCE_HA) {
      warnings.push(
        'Kun Optimér kan opfylde minimum – Års-optimeringen kan højst nå ' +
          `${areaFormat.format(yearly.highestMinHa)} ha ` +
          `${inYears(yearly.highestMinYears, 'hvert år')}.`,
      )
    }
  }
  if (max !== null) {
    if (max < optimize.lowestMaxHa - RANGE_TOLERANCE_HA) {
      warnings.push(
        'Kun Års-optimeringen kan overholde maksimum – Optimér har mindst ' +
          `${areaFormat.format(optimize.lowestMaxHa)} ha i gennemsnit.`,
      )
    }
    if (max < yearly.lowestMaxHa - RANGE_TOLERANCE_HA) {
      warnings.push(
        'Kun Optimér kan overholde maksimum – Års-optimeringen har mindst ' +
          `${areaFormat.format(yearly.lowestMaxHa)} ha ` +
          `${inYears(yearly.lowestMaxYears, 'hvert år')}.`,
      )
    }
  }
  return warnings
}

export type CropAreaViolation = {
  cropCode: number
  years: number[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const cropAreaViolationsFromDetail = (
  detail: unknown,
): CropAreaViolation[] => {
  if (!isRecord(detail) || !Array.isArray(detail.cropAreaViolations)) return []
  return detail.cropAreaViolations.flatMap((item: unknown) => {
    if (!isRecord(item)) return []
    const cropCode = item.cropCode
    if (typeof cropCode !== 'number') return []
    const years = Array.isArray(item.years)
      ? item.years.filter((year): year is number => typeof year === 'number')
      : []
    return [{ cropCode, years }]
  })
}

export const cropAreaViolationMessage = (violation: CropAreaViolation) =>
  violation.years.length === 0
    ? 'Optimeringen kan ikke opfylde kravet i gennemsnit over perioden.'
    : `Optimeringen kan ikke opfylde kravet i ${violation.years.join(', ')}.`
