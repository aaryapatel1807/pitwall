/**
 * mock-data.ts — retained only for:
 *   1. Compound type + compoundColor (used by TirePill, strategy simulator)
 *   2. teamColors / teamColorFor (kept for backward-compat — prefer teamColorByName from api-live.ts)
 *
 * All previously hardcoded race results, driver profiles, constructor arrays,
 * and chart fixtures have been removed. Live data now comes from api-live.ts.
 */

export type Compound = "Soft" | "Medium" | "Hard" | "Inter" | "Wet";

export const teamColors: Record<string, string> = {
  "Red Bull": "#3671C6",
  Ferrari: "#E8002D",
  McLaren: "#FF8000",
  Mercedes: "#27F4D2",
  "Aston Martin": "#229971",
  Alpine: "#FF87BC",
  Williams: "#64C4FF",
  Haas: "#B6BABD",
  Sauber: "#52E252",
  RB: "#6692FF",
};

/** Resolve a team color from any Ergast/OpenF1 constructor name variant. */
export function teamColorFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("red bull"))    return teamColors["Red Bull"];
  if (n.includes("ferrari"))     return teamColors.Ferrari;
  if (n.includes("mclaren"))     return teamColors.McLaren;
  if (n.includes("mercedes"))    return teamColors.Mercedes;
  if (n.includes("aston"))       return teamColors["Aston Martin"];
  if (n.includes("alpine"))      return teamColors.Alpine;
  if (n.includes("williams"))    return teamColors.Williams;
  if (n.includes("haas"))        return teamColors.Haas;
  if (n.includes("sauber") || n.includes("kick")) return teamColors.Sauber;
  if (n.includes("rb") || n.includes("racing bull") || n.includes("alphatauri"))
    return teamColors.RB;
  return "#999999";
}

export const compoundColor: Record<Compound, { bg: string; text: string; border?: string }> = {
  Soft:   { bg: "#FF1E00", text: "#FFFFFF" },
  Medium: { bg: "#FFD700", text: "#15151E" },
  Hard:   { bg: "#FFFFFF", text: "#15151E", border: "#333333" },
  Inter:  { bg: "#39B54A", text: "#FFFFFF" },
  Wet:    { bg: "#0067FF", text: "#FFFFFF" },
};
