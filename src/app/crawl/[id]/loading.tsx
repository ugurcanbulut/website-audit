import { Skeleton } from "@/components/ui/skeleton";

export default function CrawlLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <Skeleton className="h-6 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
