// Shared number/time formatting helpers for PitWall.

/**
 * Format a lap time given in seconds into F1 timing format.
 * 74.234 -> "1:14.234", 9.5 -> "0:09.500"
 */
export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

/** Format a signed delta in seconds, e.g. +0.222 / -0.108. */
export function formatDelta(seconds: number): string {
  if (!isFinite(seconds)) return "—";
  const sign = seconds > 0 ? "+" : seconds < 0 ? "" : "";
  return `${sign}${seconds.toFixed(3)}`;
}
