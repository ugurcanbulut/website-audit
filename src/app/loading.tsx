import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-2 h-12">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Section cards skeleton */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="px-4 lg:px-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
