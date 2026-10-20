const KEY = 'cantina-storage-locations'

export interface CachedLocation {
  id: string
  name: string
}

export function writeLocationCache(locations: CachedLocation[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(locations))
  } catch {
    // localStorage unavailable
  }
}

export function readLocationCache(): CachedLocation[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as CachedLocation[]
  } catch {
    return []
  }
}
