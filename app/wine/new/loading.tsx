import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <Skeleton className="h-7 w-36" />

      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 rounded-md" />
          </div>
        ))}
        <Skeleton className="h-10 rounded-md mt-2" />
      </div>
    </div>
  )
}
