function Sk({ className }: { className?: string }) {
  return <div className={`skeleton ${className ?? ""}`} />;
}

export default function RequestsLoading() {
  return (
    <div className="p-8 max-w-5xl">
      <Sk className="h-3 w-16 mb-3" />
      <Sk className="h-7 w-40 mb-2" />
      <Sk className="h-4 w-72 mb-8" />
      <div className="flex gap-2 mb-6">
        {[...Array(6)].map((_, i) => <Sk key={i} className="h-8 w-20 rounded-lg" />)}
      </div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-stone-50">
            <Sk className="h-4 w-20" />
            <Sk className="flex-1 h-4" />
            <Sk className="h-4 w-24" />
            <Sk className="h-4 w-32" />
            <Sk className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
