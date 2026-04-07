function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-stone-100 rounded-lg ${className ?? ""}`} />;
}

export default function PeopleLoading() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg ml-auto" />
      </div>

      {/* Department group */}
      {[...Array(2)].map((_, g) => (
        <div key={g} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-3 w-28" />
            <div className="flex-1 h-px bg-stone-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1.5" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
