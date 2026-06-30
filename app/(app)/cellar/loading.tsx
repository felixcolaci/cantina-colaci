import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      <div className="flex gap-2 pb-2 mb-4">
        {[80, 64, 80, 88, 96].map((w, i) => (
          <Skeleton key={i} className="h-7 shrink-0 rounded-full" style={{ width: w }} />
        ))}
      </div>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
