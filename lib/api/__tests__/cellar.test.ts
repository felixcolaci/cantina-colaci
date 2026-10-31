import { describe, it, expect } from 'vitest'
import { parseCreateCellarBody, parseCellarRename } from '../cellar'

describe('parseCreateCellarBody', () => {
  it('accepts a name on its own, seed defaulting to false', () => {
    expect(parseCreateCellarBody({ name: 'Zweiter Keller' })).toEqual({ name: 'Zweiter Keller', seed: false })
  })

  it('trims the name and caps it at 60 chars', () => {
    expect(parseCreateCellarBody({ name: '  Zweiter Keller  ' })).toEqual({ name: 'Zweiter Keller', seed: false })
    expect(parseCreateCellarBody({ name: 'x'.repeat(80) })).toEqual({ name: 'x'.repeat(60), seed: false })
  })

  it('accepts an explicit seed flag', () => {
    expect(parseCreateCellarBody({ name: 'Keller', seed: true })).toEqual({ name: 'Keller', seed: true })
    expect(parseCreateCellarBody({ name: 'Keller', seed: false })).toEqual({ name: 'Keller', seed: false })
  })

  it('rejects a missing or blank name, or a non-object body', () => {
    expect(parseCreateCellarBody({})).toBeNull()
    expect(parseCreateCellarBody({ name: '   ' })).toBeNull()
    expect(parseCreateCellarBody(null)).toBeNull()
    expect(parseCreateCellarBody('nope')).toBeNull()
  })

  it('rejects a non-boolean seed value', () => {
    expect(parseCreateCellarBody({ name: 'Keller', seed: 'yes' })).toBeNull()
  })
})

describe('parseCellarRename', () => {
  it('accepts a name', () => {
    expect(parseCellarRename({ name: 'Umbenannter Keller' })).toEqual({ name: 'Umbenannter Keller' })
  })

  it('trims the name and caps it at 60 chars', () => {
    expect(parseCellarRename({ name: '  Umbenannter Keller  ' })).toEqual({ name: 'Umbenannter Keller' })
    expect(parseCellarRename({ name: 'x'.repeat(80) })).toEqual({ name: 'x'.repeat(60) })
  })

  it('rejects a missing or blank name, or a non-object body', () => {
    expect(parseCellarRename({})).toBeNull()
    expect(parseCellarRename({ name: '   ' })).toBeNull()
    expect(parseCellarRename(null)).toBeNull()
    expect(parseCellarRename('nope')).toBeNull()
  })

  it('rejects a non-string name', () => {
    expect(parseCellarRename({ name: 42 })).toBeNull()
  })
})
