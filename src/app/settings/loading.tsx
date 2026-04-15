function Sk({ className }: { className?: string }) {
  return <div className={`skeleton ${className ?? ""}`} />;
}

export default function SettingsLoading() {
  return (
    <div className="p-8 max-w-3xl">
      <Sk className="h-3 w-16 mb-3" />
      <Sk className="h-7 w-32 mb-2" />
      <Sk className="h-4 w-64 mb-8" />
      <div className="flex gap-2 mb-6">
        {[...Array(5)].map((_, i) => <Sk key={i} className="h-8 w-24" />)}
      </div>
      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="flex-1 h-4" />
            <Sk className="h-7 w-7" />
            <Sk className="h-7 w-7" />
          </div>
        ))}
      </div>
    </div>
  );
}
