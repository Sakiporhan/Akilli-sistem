import type { ControllerStatePayload } from "../types";

/** Arayüz yedek eşiği (MQTT alanı yoksa); backend `PEAK_OCCUPANCY_THRESHOLD` ile hizalı tutun. */
export function defaultPeakOccupancyThresholdFromEnv(): number {
  const env = Number(import.meta.env.VITE_PEAK_OCCUPANCY_THRESHOLD);
  return Number.isFinite(env) && env >= 1 ? Math.floor(env) : 5;
}

export function derivePeakAndLoad(
  payload: ControllerStatePayload | null,
  occupancy: number,
  roomCapacity: number,
): { peakOccupancyThreshold: number; occupancyLoad: "normal" | "peak" } {
  const capN =
    Number.isFinite(roomCapacity) && roomCapacity >= 1 ? Math.floor(roomCapacity) : 10;

  let peak: number;
  const rawPeak = payload?.peak_occupancy_threshold;
  if (rawPeak !== undefined && rawPeak !== null) {
    const n = Number(rawPeak);
    peak = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : defaultPeakOccupancyThresholdFromEnv();
  } else {
    peak = defaultPeakOccupancyThresholdFromEnv();
  }
  peak = Math.min(peak, capN);
  peak = Math.max(1, peak);

  // Kontrolcü occupancy_load gönderiyorsa onu kullan; yoksa doluluk ≥ eşik → yoğun.
  const srv = payload?.occupancy_load;
  const load: "normal" | "peak" =
    srv === "peak" || srv === "normal"
      ? srv
      : occupancy >= peak
        ? "peak"
        : "normal";

  return { peakOccupancyThreshold: peak, occupancyLoad: load };
}
