import type { HistoryRow } from "../types";

export type TimeRangePreset = "all" | "15m" | "1h" | "today";

export type EventCategoryFilter =
  | "all"
  | "entry"
  | "exit"
  | "fire"
  | "reset"
  | "inactivity"
  | "idle"
  | "emergency_only"
  | "safe_only";

/** Tarayıcının yerel saat diliminde gün başı (Bugün filtresi). */
function startOfLocalDayMs(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rangeLowerBound(preset: TimeRangePreset): number | null {
  const now = Date.now();
  if (preset === "all") return null;
  if (preset === "today") return startOfLocalDayMs(now);
  if (preset === "15m") return now - 15 * 60 * 1000;
  if (preset === "1h") return now - 60 * 60 * 1000;
  return null;
}

export function filterHistoryRows(
  rows: HistoryRow[],
  search: string,
  category: EventCategoryFilter,
  timePreset: TimeRangePreset,
): HistoryRow[] {
  const q = search.trim().toLowerCase();
  const lower = rangeLowerBound(timePreset);

  return rows.filter((r) => {
    if (lower !== null) {
      const ms = r.recordedAtMs;
      if (typeof ms !== "number" || !Number.isFinite(ms)) return true;
      if (ms < lower) return false;
    }

    if (category === "emergency_only" && !r.emergency) return false;
    if (category === "safe_only" && r.emergency) return false;
    if (
      category !== "all" &&
      category !== "emergency_only" &&
      category !== "safe_only" &&
      r.eventKind !== category
    ) {
      return false;
    }

    if (!q) return true;
    const hay = [
      r.event,
      r.source ?? "",
      r.emergencyReason ?? "",
      String(r.occupancy),
      r.temperatureC !== undefined ? String(r.temperatureC) : "",
      r.eventKind,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
