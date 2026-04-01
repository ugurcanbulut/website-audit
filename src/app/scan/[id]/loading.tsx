import { Skeleton } from "@/components/ui/skeleton";

export default function ScanLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-4 w-96" />

      {/* Tabs skeleton */}
      <div className="flex gap-2 mt-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
