function Sk({ className }: { className?: string }) {
  return <div className={`skeleton ${className ?? ""}`} />;
}

export default function AuditLoading() {
  return (
    <div className="p-8 max-w-6xl">
      <Sk className="h-3 w-16 mb-3" />
      <Sk className="h-7 w-32 mb-2" />
      <Sk className="h-4 w-80 mb-8" />
      <div className="flex gap-2 mb-4">
        <Sk className="h-8 w-32" />
        <Sk className="h-8 w-48" />
      </div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-stone-50">
            <Sk className="h-4 w-24" />
            <Sk className="h-4 w-28" />
            <Sk className="flex-1 h-4" />
            <Sk className="h-4 w-32" />
            <Sk className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
