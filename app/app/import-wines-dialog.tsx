'use client'

import { useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import { useQuery, usePowerSync } from '@powersync/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TARGET_FIELDS, type ColumnMapping } from '@/lib/import/fields'
import { parseImportFile, suggestMapping, type ImportTable } from '@/lib/import/parse-file'
import { validateRow, rowHasErrors, type ParsedRow } from '@/lib/import/validate-row'
import { commitImportRows, matchKey } from '@/lib/import/commit-rows'

type Step = 'upload' | 'mapping' | 'preview'

const NONE = '__none__'

// Dreistufiger Wizard, komplett lokaler State -- kein Schritt verlässt das
// Gerät außer den finalen writeTransaction-Aufrufen in commitImportRows.
// editableRows ist eine mutierbare Kopie von table.rows, damit Inline-
// Korrekturen in der Vorschau nicht die Originaldatei anfassen.
export function ImportWinesDialog({ cellarId }: { cellarId: string }) {
  const db = usePowerSync()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [table, setTable] = useState<ImportTable | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [editableRows, setEditableRows] = useState<unknown[][]>([])
  const [included, setIncluded] = useState<boolean[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [summary, setSummary] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: existingWines } = useQuery<{ name: string; producer: string }>(
    `SELECT name, producer FROM wines WHERE cellar_id = ?`,
    [cellarId],
  )
  const existingKeys = useMemo(
    () => new Set(existingWines.map(w => matchKey(w.name, w.producer))),
    [existingWines],
  )

  function reset() {
    setStep('upload'); setTable(null); setMapping({}); setEditableRows([])
    setIncluded([]); setSummary(null); setError(null)
  }

  async function handleFile(file: File) {
    setError(null)
    const parsed = await parseImportFile(file)
    if (parsed.rows.length === 0) {
      setError('Die Datei enthält keine Datenzeilen.')
      return
    }
    setTable(parsed)
    setMapping(suggestMapping(parsed.headers))
    setEditableRows(parsed.rows.map(row => [...row]))
    setStep('mapping')
  }

  const parsedRows: ParsedRow[] = useMemo(
    () => editableRows.map(row => validateRow(row, mapping)),
    [editableRows, mapping],
  )

  const requiredMapped = TARGET_FIELDS.filter(f => f.required).every(f => mapping[f.key] != null)

  function goToPreview() {
    setIncluded(parsedRows.map(row => !rowHasErrors(row)))
    setStep('preview')
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    setEditableRows(prev => {
      const next = prev.map(row => [...row])
      next[rowIndex][columnIndex] = value
      return next
    })
  }

  const selectedCount = included.filter((isIncluded, i) => isIncluded && !rowHasErrors(parsedRows[i])).length

  async function handleImport() {
    setIsImporting(true)
    try {
      const selected = parsedRows
        .map((row, i) => ({ row, isIncluded: included[i] }))
        .filter(({ row, isIncluded }) => isIncluded && !rowHasErrors(row))
        .map(({ row }) => row.values)

      const result = await commitImportRows(db, cellarId, selected)
      setSummary({ imported: result.imported, skipped: editableRows.length - selected.length + result.failed })
    } finally {
      setIsImporting(false)
    }
  }

  const mappedFields = TARGET_FIELDS.filter(f => mapping[f.key] != null)

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) reset() }}>
      <DialogTrigger render={
        <Button size="icon-sm" variant="outline" aria-label="Weine importieren">
          <Upload className="h-3.5 w-3.5" />
        </Button>
      } />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Weine importieren</DialogTitle>
          <DialogDescription>CSV- oder Excel-Datei mit mehreren Weinen auf einmal übernehmen.</DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <Input
              type="file"
              accept=".csv,.xlsx"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            {error && <p style={{ color: 'var(--destructive)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          </div>
        )}

        {step === 'mapping' && table && (
          <div className="space-y-4">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted-foreground)' }}>
              Welche Spalte deiner Datei entspricht welchem Feld? Pflichtfelder sind markiert (*).
            </p>
            <div className="space-y-3">
              {TARGET_FIELDS.map(field => (
                <div key={field.key} className="flex items-center justify-between gap-3">
                  <Label>{field.label}{field.required ? ' *' : ''}</Label>
                  <Select
                    value={mapping[field.key] != null ? String(mapping[field.key]) : NONE}
                    onValueChange={value => setMapping(prev => ({
                      ...prev,
                      [field.key]: value === NONE ? undefined : Number(value),
                    }))}
                  >
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>nicht importieren</SelectItem>
                      {table.headers.map((header, i) => (
                        <SelectItem key={i} value={String(i)}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Zurück</Button>
              <Button disabled={!requiredMapped} onClick={goToPreview}>Weiter</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && !summary && (
          <div className="space-y-4">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th></th>
                    {mappedFields.map(f => (
                      <th key={f.key} className="text-left pr-3">{f.label}</th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((parsedRow, rowIndex) => {
                    const isMatch = existingKeys.has(matchKey(parsedRow.values.name, parsedRow.values.producer))
                    return (
                      <tr key={rowIndex}>
                        <td>
                          <Checkbox
                            checked={included[rowIndex] ?? false}
                            disabled={rowHasErrors(parsedRow)}
                            onCheckedChange={checked => setIncluded(prev => {
                              const next = [...prev]
                              next[rowIndex] = checked
                              return next
                            })}
                          />
                        </td>
                        {mappedFields.map(field => {
                          const columnIndex = mapping[field.key]!
                          const fieldError = parsedRow.errors[field.key]
                          return (
                            <td key={field.key} className="pr-3 pb-2">
                              <Input
                                value={String(editableRows[rowIndex][columnIndex] ?? '')}
                                onChange={e => updateCell(rowIndex, columnIndex, e.target.value)}
                                style={fieldError ? { borderColor: 'var(--destructive)' } : undefined}
                                title={fieldError}
                              />
                            </td>
                          )
                        })}
                        <td>{isMatch && <span className="eyebrow">bereits im Keller</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('mapping')}>Zurück</Button>
              <Button disabled={selectedCount === 0 || isImporting} onClick={handleImport}>
                {selectedCount} {selectedCount === 1 ? 'Wein' : 'Weine'} importieren
              </Button>
            </DialogFooter>
          </div>
        )}

        {summary && (
          <div className="space-y-4">
            <p>{summary.imported} importiert{summary.skipped > 0 ? `, ${summary.skipped} übersprungen` : ''}.</p>
            <DialogFooter>
              <DialogClose render={<Button />}>Fertig</DialogClose>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
