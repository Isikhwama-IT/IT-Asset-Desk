function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-stone-100 rounded-lg ${className ?? ""}`} />;
}

export default function AssetDetailLoading() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Skeleton className="h-4 w-24 mb-6" />

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-16 rounded-lg" />
        </div>
      </div>

      {/* Two-col details */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-5">
            <Skeleton className="h-4 w-28 mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* History table */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <Skeleton className="h-4 w-36 mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3 w-32 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
