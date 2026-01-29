export default function LoadingItems() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="h-8 w-40 bg-slate-200 rounded animate-pulse" />
      <div className="mt-4 h-14 bg-slate-100 border rounded-xl animate-pulse" />
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-56 bg-slate-100 border rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
