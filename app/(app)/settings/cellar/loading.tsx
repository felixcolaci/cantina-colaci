import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  )
}
