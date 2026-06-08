export default function PrinterMonitorLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-pulse">
      <div className="h-6 w-48 bg-stone-100 rounded mb-1" />
      <div className="h-4 w-72 bg-stone-100 rounded mb-8" />
      <div className="h-14 bg-stone-100 rounded-xl mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-stone-100 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-52 bg-stone-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
