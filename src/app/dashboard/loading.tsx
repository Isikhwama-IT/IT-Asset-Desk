function Sk({ className }: { className?: string }) {
  return <div className={`skeleton ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <Sk className="h-7 w-40 mb-2" />
        <Sk className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-stone-200 p-5">
            <Sk className="h-8 w-8 mb-3 rounded-lg" />
            <Sk className="h-8 w-16 mb-1" />
            <Sk className="h-3.5 w-24 mb-1" />
            <Sk className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <Sk className="h-4 w-28 mb-4" />
          <Sk className="h-40 w-40 rounded-full mx-auto mb-4" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Sk key={i} className="h-3 w-full" />)}
          </div>
        </div>
        <div className="col-span-2 bg-white rounded-xl border border-stone-200 p-5">
          <Sk className="h-4 w-36 mb-4" />
          <Sk className="h-52 w-full" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <Sk className="h-4 w-40 mb-4" />
        <Sk className="h-48 w-full" />
      </div>
      <div className="bg-white rounded-xl border border-stone-200">
        <div className="px-5 py-4 border-b border-stone-100">
          <Sk className="h-4 w-32" />
        </div>
        <div className="divide-y divide-stone-50">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <Sk className="h-7 w-7 rounded-lg" />
              <div className="flex-1">
                <Sk className="h-3.5 w-48 mb-1.5" />
                <Sk className="h-3 w-32" />
              </div>
              <Sk className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
