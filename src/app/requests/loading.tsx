export default function RequestsLoading() {
  return (
    <div className="p-8 max-w-5xl animate-pulse">
      <div className="h-3 w-16 bg-stone-200 rounded mb-3" />
      <div className="h-7 w-40 bg-stone-200 rounded mb-2" />
      <div className="h-4 w-72 bg-stone-100 rounded mb-8" />
      <div className="flex gap-2 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-stone-200 rounded-lg" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-stone-50">
            <div className="h-4 w-20 bg-stone-100 rounded" />
            <div className="flex-1 h-4 bg-stone-100 rounded" />
            <div className="h-4 w-24 bg-stone-100 rounded" />
            <div className="h-4 w-32 bg-stone-100 rounded" />
            <div className="h-5 w-16 bg-stone-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
