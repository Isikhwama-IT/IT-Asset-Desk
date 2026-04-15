function Sk({ className }: { className?: string }) {
  return <div className={`skeleton ${className ?? ""}`} />;
}

export default function PeopleLoading() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <Sk className="h-7 w-24 mb-2" />
        <Sk className="h-4 w-48" />
      </div>
      <div className="flex items-center gap-3 mb-6">
        <Sk className="h-9 w-64" />
        <Sk className="h-9 w-36" />
        <Sk className="h-9 w-32" />
        <Sk className="h-9 w-28" />
        <Sk className="h-9 w-28 ml-auto" />
      </div>
      {[...Array(2)].map((_, g) => (
        <div key={g} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Sk className="h-3 w-28" />
            <div className="flex-1 h-px bg-stone-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 flex items-center gap-3">
                <Sk className="h-9 w-9 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <Sk className="h-4 w-32 mb-1.5" />
                  <Sk className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
