import type { CropAreaLimit, FieldRecord } from '@/api/types'

export type AreaBound = 'min' | 'max'

export type CropAreaLimitDraft = {
  cropCode: number
  minHa: string
  maxHa: string
  minPct: string
  maxPct: string
}

const HECTARE_DECIMALS = 2
const PERCENT_DECIMALS = 1

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

export const percentToHectares = (percent: number, totalAreaHa: number) =>
  round((percent / 100) * totalAreaHa, HECTARE_DECIMALS)

const hectaresInputToPercentInput = (value: string, totalAreaHa: number) => {
  const areaHa = parseInput(value)
  if (areaHa === null || Number.isNaN(areaHa)) return ''
  const percent = hectaresToPercent(areaHa, totalAreaHa)
  return percent === null ? '' : String(percent)
}

const percentInputToHectaresInput = (value: string, totalAreaHa: number) => {
  const percent = parseInput(value)
  if (percent === null || Number.isNaN(percent)) return ''
  return String(percentToHectares(percent, totalAreaHa))
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

export const withPercent = (
  draft: CropAreaLimitDraft,
  bound: AreaBound,
  value: string,
  totalAreaHa: number,
): CropAreaLimitDraft => ({
  ...draft,
  [percentKey(bound)]: value,
  [hectaresKey(bound)]: percentInputToHectaresInput(value, totalAreaHa),
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
