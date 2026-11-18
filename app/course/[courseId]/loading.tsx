import { Skeleton } from "@/components/ui/skeleton";

export default function CourseLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Back button skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36 rounded-xl" />
      </div>

      {/* Course Header Banner skeleton */}
      <div className="p-6 sm:p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card shadow-xs space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-64 rounded-lg" />
            <Skeleton className="h-3 w-36 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-4 w-full max-w-xl rounded-md" />
      </div>

      {/* Tabs bar skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>

        {/* Course Cards / Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
              <Skeleton className="h-6 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
              <div className="pt-2 flex justify-end">
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
