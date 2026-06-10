import { compoundColor, type Compound } from "@/lib/mock-data";

export function TirePill({ compound }: { compound: Compound }) {
  const c = compoundColor[compound];
  const letter = compound === "Inter" ? "I" : compound[0];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide tabular"
      style={{
        backgroundColor: c.bg,
        color: c.text,
        border: c.border ? `1px solid ${c.border}` : "1px solid transparent",
      }}
    >
      <span
        className="grid h-3.5 w-3.5 place-items-center rounded-full text-[9px]"
        style={{ border: `2px solid ${c.text}` }}
      >
        {letter}
      </span>
      {compound}
    </span>
  );
}
