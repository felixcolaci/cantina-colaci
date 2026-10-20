import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <Skeleton className="h-7 w-36" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}
