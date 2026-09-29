import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { CropCodeOption } from '@/api/types'
import { SearchableCropPickerList } from '@/components/farm/SearchableCropPickerList'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field-error'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  cropAreaLimitError,
  emptyCropAreaLimitDraft,
  withHectares,
  withPercent,
  type AreaBound,
  type CropAreaLimitDraft,
} from '@/lib/crop-area-limits'
import { cropGroupColor } from '@/lib/crop-groups'

const BOUND_LABELS: Record<AreaBound, string> = {
  min: 'Minimum',
  max: 'Maksimum',
}

type BoundInputsProps = {
  idPrefix: string
  bound: AreaBound
  hectares: string
  percent: string
  percentDisabled: boolean
  describedBy?: string
  onHectaresChange: (value: string) => void
  onPercentChange: (value: string) => void
}

const BoundInputs = ({
  idPrefix,
  bound,
  hectares,
  percent,
  percentDisabled,
  describedBy,
  onHectaresChange,
  onPercentChange,
}: BoundInputsProps) => (
  <div className="space-y-1">
    <Label
      htmlFor={`${idPrefix}-${bound}-ha`}
      className="text-xs font-normal text-muted-foreground"
    >
      {BOUND_LABELS[bound]}
    </Label>
    <div className="grid grid-cols-2 gap-2">
      <div className="flex items-center gap-1.5">
        <Input
          id={`${idPrefix}-${bound}-ha`}
          type="number"
          min="0"
          step="any"
          value={hectares}
          placeholder="Ingen"
          aria-describedby={describedBy}
          onChange={(event) => onHectaresChange(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">ha</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          id={`${idPrefix}-${bound}-pct`}
          type="number"
          min="0"
          max="100"
          step="any"
          value={percent}
          placeholder="Ingen"
          disabled={percentDisabled}
          aria-label={`${BOUND_LABELS[bound]} i procent`}
          aria-describedby={describedBy}
          onChange={(event) => onPercentChange(event.target.value)}
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  </div>
)

type CropAreaLimitsEditorProps = {
  drafts: CropAreaLimitDraft[]
  cropCodes: CropCodeOption[]
  totalAreaHa: number
  onChange: (drafts: CropAreaLimitDraft[]) => void
}

export const CropAreaLimitsEditor = ({
  drafts,
  cropCodes,
  totalAreaHa,
  onChange,
}: CropAreaLimitsEditorProps) => {
  const [isPicking, setIsPicking] = useState(false)

  const nameByCode = useMemo(
    () => new Map(cropCodes.map((crop) => [crop.code, crop.name])),
    [cropCodes],
  )

  const pickerItems = useMemo(() => {
    const limitedCodes = new Set(drafts.map((draft) => draft.cropCode))
    return cropCodes
      .filter((crop) => !limitedCodes.has(crop.code))
      .map((crop) => ({
        key: String(crop.code),
        label: crop.name,
        title: `${crop.name} (${crop.code})`,
        colors: [cropGroupColor(crop.code, crop.name)],
        meta: String(crop.code),
      }))
  }, [cropCodes, drafts])

  const addCrop = (key: string) => {
    onChange([...drafts, emptyCropAreaLimitDraft(Number(key))])
    setIsPicking(false)
  }

  const replaceDraft = (index: number, draft: CropAreaLimitDraft) =>
    onChange(drafts.map((current, i) => (i === index ? draft : current)))

  const removeDraft = (index: number) =>
    onChange(drafts.filter((_, i) => i !== index))

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-medium leading-none text-foreground">
        Areal af afgrøder
      </legend>
      <p className="text-xs text-muted-foreground">
        Hvor meget der mindst og højst skal dyrkes af en afgrøde. Procent er af
        simuleringens samlede areal
        {totalAreaHa > 0
          ? ` på ${totalAreaHa.toLocaleString('da-DK', { maximumFractionDigits: 2 })} ha`
          : ''}
        .
      </p>

      {drafts.length > 0 ? (
        <ul className="space-y-3">
          {drafts.map((draft, index) => {
            const idPrefix = `rules-crop-area-${draft.cropCode}`
            const name =
              nameByCode.get(draft.cropCode) ?? `Afgrødekode ${draft.cropCode}`
            const error = cropAreaLimitError(draft)
            const errorId = `${idPrefix}-error`
            return (
              <li
                key={draft.cropCode}
                className="space-y-2 rounded-lg border bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-[14px] w-[10px] shrink-0 rounded-[3px]"
                    style={{
                      backgroundColor: cropGroupColor(draft.cropCode, name),
                    }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {name}
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      · {draft.cropCode}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={`Fjern kravet til ${name}`}
                    onClick={() => removeDraft(index)}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['min', 'max'] as const).map((bound) => (
                    <BoundInputs
                      key={bound}
                      idPrefix={idPrefix}
                      bound={bound}
                      hectares={bound === 'min' ? draft.minHa : draft.maxHa}
                      percent={bound === 'min' ? draft.minPct : draft.maxPct}
                      percentDisabled={totalAreaHa <= 0}
                      describedBy={error ? errorId : undefined}
                      onHectaresChange={(value) =>
                        replaceDraft(
                          index,
                          withHectares(draft, bound, value, totalAreaHa),
                        )
                      }
                      onPercentChange={(value) =>
                        replaceDraft(
                          index,
                          withPercent(draft, bound, value, totalAreaHa),
                        )
                      }
                    />
                  ))}
                </div>
                <FieldError id={errorId} message={error} />
              </li>
            )
          })}
        </ul>
      ) : null}

      {isPicking ? (
        <div className="space-y-2 rounded-lg border bg-background p-3">
          <SearchableCropPickerList
            items={pickerItems}
            selectedKey={null}
            onSelect={addCrop}
            searchLabel="Søg i simuleringens afgrøder"
            searchPlaceholder="Søg i afgrøder..."
            emptyMessage={
              cropCodes.length === 0
                ? 'Simuleringen har ingen afgrøder'
                : 'Ingen afgrøder matcher søgningen'
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setIsPicking(false)}
          >
            Annuller
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsPicking(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tilføj afgrøde
        </Button>
      )}
    </fieldset>
  )
}
