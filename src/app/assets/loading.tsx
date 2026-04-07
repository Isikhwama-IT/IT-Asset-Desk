import type { CSSProperties } from "react";

function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse bg-stone-100 rounded-lg ${className ?? ""}`} style={style} />;
}

export default function AssetsLoading() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="flex gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50">
          {[40, 200, 100, 120, 110, 100, 30].map((w, i) => (
            <Skeleton key={i} className="h-3 rounded" style={{ width: w }} />
          ))}
        </div>
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3.5 border-b border-stone-50 items-center">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
