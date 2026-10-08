export default function Loading() {
  return (
    <div aria-busy="true" aria-label="טוען" className="animate-pulse">
      <div className="mb-5 h-8 w-48 rounded-lg bg-muted" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-[14px] bg-muted" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-[14px] bg-muted" />
        ))}
      </div>
    </div>
  );
}
