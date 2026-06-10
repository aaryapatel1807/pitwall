export function SectionLabel({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`section-label ${dark ? "text-[#A0A0B0]" : "text-[#6B6B6B]"}`}>{children}</p>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 w-full animate-pulse rounded-md bg-[#E5E5E5]"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title = "No data available",
  message = "There's nothing to show here yet.",
  icon = "🏎️",
}: {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#E5E5E5] bg-[#F5F5F5] px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[#15151E] text-2xl">
        {icon}
      </div>
      <h3 className="mt-1 text-base font-bold uppercase tracking-tight text-[#15151E]">{title}</h3>
      <p className="max-w-xs text-sm text-[#6B6B6B]">{message}</p>
    </div>
  );
}
