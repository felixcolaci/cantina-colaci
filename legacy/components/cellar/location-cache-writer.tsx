'use client'

import { useEffect } from 'react'
import { writeLocationCache } from '@/lib/offline/location-cache'
import type { CachedLocation } from '@/lib/offline/location-cache'

export function LocationCacheWriter({ locations }: { locations: CachedLocation[] }) {
  useEffect(() => {
    writeLocationCache(locations)
  }, [locations])
  return null
}
