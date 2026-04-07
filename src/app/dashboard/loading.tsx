function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-stone-100 rounded-lg ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Two-col layout */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-stone-200 p-5">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
