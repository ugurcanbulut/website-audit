import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
