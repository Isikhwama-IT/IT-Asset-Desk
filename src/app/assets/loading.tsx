import type { CSSProperties } from "react";

function Sk({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className ?? ""}`} style={style} />;
}

export default function AssetsLoading() {
  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Sk className="h-7 w-24 mb-2" />
          <Sk className="h-4 w-40" />
        </div>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <Sk className="h-9 w-64" />
        <Sk className="h-9 w-28" />
        <Sk className="h-9 w-28" />
        <Sk className="h-9 w-28" />
        <div className="ml-auto flex gap-2">
          <Sk className="h-9 w-20" />
          <Sk className="h-9 w-24" />
        </div>
      </div>
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="flex gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50">
          {[40, 200, 100, 120, 110, 100, 30].map((w, i) => (
            <Sk key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3.5 border-b border-stone-50 items-center">
            <Sk className="h-4 w-10" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-4 w-24" />
            <Sk className="h-4 w-28" />
            <Sk className="h-4 w-24" />
            <Sk className="h-5 w-20 rounded-full" />
            <Sk className="h-4 w-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
