import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseImportFile, suggestMapping } from '../parse-file'

function csvFile(content: string): File {
  return new File([content], 'import.csv', { type: 'text/csv' })
}

async function xlsxFile(rows: unknown[][]): Promise<File> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  for (const row of rows) sheet.addRow(row)
  const buffer = await workbook.xlsx.writeBuffer()
  return new File([buffer], 'import.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

describe('parseImportFile', () => {
  it('parses a CSV file into headers + rows', async () => {
    const table = await parseImportFile(csvFile('Name,Produzent\nBarolo,Gaja\nChianti,Antinori'))
    expect(table.headers).toEqual(['Name', 'Produzent'])
    expect(table.rows).toEqual([['Barolo', 'Gaja'], ['Chianti', 'Antinori']])
  })

  it('parses a CSV file with quoted fields containing commas', async () => {
    const table = await parseImportFile(csvFile('Name,Notizen\nBarolo,"viel Tannin, elegant"'))
    expect(table.rows).toEqual([['Barolo', 'viel Tannin, elegant']])
  })

  it('parses an XLSX file into headers + rows', async () => {
    const table = await parseImportFile(await xlsxFile([['Name', 'Produzent'], ['Barolo', 'Gaja']]))
    expect(table.headers).toEqual(['Name', 'Produzent'])
    expect(table.rows).toEqual([['Barolo', 'Gaja']])
  })

  it('produces identical headers+rows for equivalent CSV and XLSX input', async () => {
    const fromCsv = await parseImportFile(csvFile('Name,Produzent\nBarolo,Gaja'))
    const fromXlsx = await parseImportFile(await xlsxFile([['Name', 'Produzent'], ['Barolo', 'Gaja']]))
    expect(fromCsv).toEqual(fromXlsx)
  })

  it('falls back to generic column names when the header row is blank', async () => {
    const table = await parseImportFile(csvFile(',\nBarolo,Gaja'))
    expect(table.headers).toEqual(['Spalte 1', 'Spalte 2'])
    expect(table.rows).toEqual([['Barolo', 'Gaja']])
  })

  it('returns an empty table for a file with no data rows', async () => {
    const table = await parseImportFile(csvFile('Name,Produzent'))
    expect(table.rows).toEqual([])
  })

  it('returns an empty table for a completely empty file', async () => {
    const table = await parseImportFile(csvFile(''))
    expect(table).toEqual({ headers: [], rows: [] })
  })

  it('skips a blank trailing line without producing a phantom row', async () => {
    const table = await parseImportFile(csvFile('Name,Produzent\nBarolo,Gaja\n\n'))
    expect(table.rows).toEqual([['Barolo', 'Gaja']])
  })
})

describe('suggestMapping', () => {
  it('suggests producer for a column named "Winzer" or "Produzent"', () => {
    expect(suggestMapping(['Name', 'Winzer']).producer).toBe(1)
    expect(suggestMapping(['Name', 'Produzent']).producer).toBe(1)
  })

  it('leaves a field unmapped when no header matches', () => {
    expect(suggestMapping(['Name']).producer).toBeUndefined()
  })

  it('never maps the same column index to two different fields', () => {
    const mapping = suggestMapping(['Name'])
    const indices = Object.values(mapping)
    expect(new Set(indices).size).toBe(indices.length)
  })
})
