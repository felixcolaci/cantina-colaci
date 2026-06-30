import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <Skeleton className="h-7 w-28" />

      <Skeleton className="h-40 rounded-xl" />

      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
    </div>
  )
}
