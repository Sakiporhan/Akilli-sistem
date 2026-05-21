import type { ControllerStatePayload, HistoryRow } from "../types";

let idCounter = 0;
function uid(): string {
  idCounter += 1;
  return `h-${Date.now()}-${idCounter}`;
}

const labelMap: Record<string, string> = {
  fire: "Sıcaklık Eşiği Aşıldı",
  reset: "Acil Durum Sıfırlandı",
  exit: "Kişi Çıkışı",
  entry: "Kişi Girişi",
  idle: "Beklemede",
  inactivity: "Hareketsizlik",
};

function formatTemp(c: number | undefined): number | undefined {
  if (c === undefined || !Number.isFinite(c)) return undefined;
  return Math.round(c * 10) / 10;
}

function recordedAtFromPayload(payload: ControllerStatePayload): number {
  const raw = payload.updated_at;
  if (raw) {
    const ms = new Date(raw).getTime();
    if (!Number.isNaN(ms)) return ms;
  }
  return Date.now();
}

export function buildHistoryRow(payload: ControllerStatePayload): HistoryRow {
  const eventType = String(payload.last_event_type ?? "idle")
    .trim()
    .toLowerCase();
  let occ = 0;
  if (payload.occupancy !== undefined && payload.occupancy !== null) {
    const n = Number(payload.occupancy);
    if (Number.isFinite(n)) occ = Math.max(0, Math.floor(n));
  }
  const emg =
    payload.emergency === true ||
    payload.emergency === 1 ||
    String(payload.emergency).toLowerCase() === "true";

  let evLabel = labelMap[eventType] ?? eventType;
  if (eventType === "exit" && occ === 0) {
    evLabel = "Oda Terk Edildi";
  }
  if (eventType === "fire") {
    evLabel = "Sıcaklık Eşiği Aşıldı";
  }
  if (eventType === "reset") {
    const src = String(payload.last_event_source ?? "").toLowerCase();
    if (src.includes("temperature") || src.includes("hysteresis")) {
      evLabel = "Sıcaklık Normalleşti";
    }
  }

  const time = payload.updated_at
    ? new Date(payload.updated_at).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Europe/Istanbul",
      })
    : "-";

  const reasonRaw = String(payload.last_emergency_reason ?? "").trim();
  const temp = formatTemp(
    payload.temperature_c !== undefined ? Number(payload.temperature_c) : undefined,
  );

  return {
    id: uid(),
    time,
    event: evLabel,
    occupancy: occ,
    emergency: emg,
    recordedAtMs: recordedAtFromPayload(payload),
    eventKind: eventType,
    source: String(payload.last_event_source ?? "").trim() || undefined,
    temperatureC: temp,
    emergencyReason: reasonRaw || undefined,
  };
}

export function semanticKey(payload: ControllerStatePayload): string {
  const eventType = String(payload.last_event_type ?? "idle")
    .trim()
    .toLowerCase();
  const occ =
    payload.occupancy !== undefined && payload.occupancy !== null
      ? Number(payload.occupancy)
      : 0;
  const occN = Number.isFinite(occ) ? occ : 0;
  const emg =
    payload.emergency === true ||
    payload.emergency === 1 ||
    String(payload.emergency).toLowerCase() === "true";
  const ts = String(payload.updated_at ?? "");
  return `${eventType}|${occN}|${emg ? 1 : 0}|${ts}`;
}

export function appendHistoryDistinct(
  prev: HistoryRow[],
  payload: ControllerStatePayload,
  lastSemantic: string | null,
): { rows: HistoryRow[]; semantic: string | null } {
  const sem = semanticKey(payload);
  if (sem === lastSemantic) {
    return { rows: prev, semantic: lastSemantic };
  }
  const row = buildHistoryRow(payload);
  const next = [...prev, row].slice(-50);
  return { rows: next, semantic: sem };
}
