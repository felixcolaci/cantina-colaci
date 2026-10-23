import { useState } from 'react'

// Resets to page 1 whenever `resetKey` changes (e.g. the search term or a
// filter), so a stale page number never shows an empty list after the
// filters narrow the result set. Adjusts state during render instead of in
// a useEffect -- see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
export function useResettablePage(resetKey: unknown) {
  const [page, setPage] = useState(1)
  const [prevKey, setPrevKey] = useState(resetKey)

  if (resetKey !== prevKey) {
    setPrevKey(resetKey)
    setPage(1)
    return [1, setPage] as const
  }

  return [page, setPage] as const
}
