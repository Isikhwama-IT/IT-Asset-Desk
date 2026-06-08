export default function ContractsLoading() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-pulse">
      <div className="h-4 w-32 bg-stone-100 rounded mb-6" />
      <div className="h-7 w-64 bg-stone-100 rounded mb-6" />
      <div className="h-12 bg-stone-100 rounded-xl mb-3" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 bg-stone-50 rounded-xl mb-2" />
      ))}
    </div>
  );
}
