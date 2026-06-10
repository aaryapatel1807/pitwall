import { useEffect, useState } from "react";

// Countdown to the next race weekend (kept in the future for a live demo feel)
const TARGET = Date.now() + (3 * 86400 + 14 * 3600 + 22 * 60 + 9) * 1000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Countdown() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let diff = Math.max(0, TARGET - now);
  const d = Math.floor(diff / 86400000);
  diff -= d * 86400000;
  const h = Math.floor(diff / 3600000);
  diff -= h * 3600000;
  const m = Math.floor(diff / 60000);
  diff -= m * 60000;
  const s = Math.floor(diff / 1000);

  const parts = [
    { v: pad(d), l: "Days" },
    { v: pad(h), l: "Hrs" },
    { v: pad(m), l: "Min" },
    { v: pad(s), l: "Sec" },
  ];

  return (
    <div className="flex gap-2">
      {parts.map((p) => (
        <div key={p.l} className="flex-1 rounded-md bg-[#15151E] px-2 py-2 text-center">
          <div className="tabular text-2xl font-extrabold text-white">{p.v}</div>
          <div className="text-[10px] uppercase tracking-wide text-[#A0A0B0]">{p.l}</div>
        </div>
      ))}
    </div>
  );
}
