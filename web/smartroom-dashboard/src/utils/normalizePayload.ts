import type { ControllerStatePayload } from "../types";

/**
 * MQTT / JSON bazen sayıları string, last_event_type'ı beklenmedik tipte gönderebilir.
 * WebSocket işleyicisinde güvenli tek tip.
 */
export function normalizeControllerPayload(
  raw: ControllerStatePayload,
): ControllerStatePayload {
  let occupancy: number | undefined;
  if (raw.occupancy !== undefined && raw.occupancy !== null) {
    const n = Number(raw.occupancy);
    if (Number.isFinite(n)) occupancy = Math.max(0, Math.floor(n));
  }

  let temperature_c: number | undefined;
  if (raw.temperature_c !== undefined && raw.temperature_c !== null) {
    const t = Number(raw.temperature_c);
    if (Number.isFinite(t)) temperature_c = t;
  }

  let peak_occupancy_threshold: number | undefined;
  if (raw.peak_occupancy_threshold !== undefined && raw.peak_occupancy_threshold !== null) {
    const p = Number(raw.peak_occupancy_threshold);
    if (Number.isFinite(p)) peak_occupancy_threshold = Math.max(1, Math.floor(p));
  }

  let occupancy_load: "normal" | "peak" | undefined;
  const ol = raw.occupancy_load;
  if (ol === "peak" || ol === "normal") {
    occupancy_load = ol;
  } else if (ol != null) {
    const s = String(ol).toLowerCase().trim();
    if (s === "peak" || s === "normal") occupancy_load = s;
  }

  const emergency =
    raw.emergency === true ||
    raw.emergency === 1 ||
    String(raw.emergency).toLowerCase() === "true";

  return {
    ...raw,
    occupancy,
    emergency,
    temperature_c,
    peak_occupancy_threshold,
    occupancy_load,
    last_event_type:
      raw.last_event_type !== undefined && raw.last_event_type !== null
        ? String(raw.last_event_type)
        : undefined,
    last_emergency_reason:
      raw.last_emergency_reason !== undefined && raw.last_emergency_reason !== null
        ? String(raw.last_emergency_reason)
        : undefined,
    last_event_source:
      raw.last_event_source !== undefined && raw.last_event_source !== null
        ? String(raw.last_event_source)
        : undefined,
    updated_at:
      raw.updated_at !== undefined && raw.updated_at !== null
        ? String(raw.updated_at)
        : undefined,
    room_id:
      raw.room_id !== undefined && raw.room_id !== null ? String(raw.room_id) : undefined,
  };
}
