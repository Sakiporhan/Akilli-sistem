import { useCallback, useEffect, useRef, useState } from "react";
import { getBridgeApiUrl, getBridgeWsUrl } from "../config/bridge";
import type {
  ChartPoint,
  ControllerStatePayload,
  HistoryRow,
  ThresholdInfo,
} from "../types";
import { appendOccupancyPoint } from "../utils/chartPoints";
import { appendHistoryDistinct } from "../utils/eventHistory";
import { normalizeControllerPayload } from "../utils/normalizePayload";
import { derivePeakAndLoad } from "../utils/occupancyLoad";

const ROOM_ID = import.meta.env.VITE_ROOM_ID ?? "room1";

function isoNow(): string {
  return new Date().toISOString();
}

/** MQTT state bazen sayi disi gelebilir; NaN gondermek FastAPI 422 uretir */
function safeTempC(c: number): number {
  const n = Number(c);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

function shortActionError(status: number, body: string): string {
  if (status === 422) {
    try {
      const j = JSON.parse(body) as { detail?: unknown };
      if (typeof j.detail === "string" && j.detail.trim()) return j.detail.trim();
    } catch {
      /* ham metin */
    }
    const plain = body.replace(/\s+/g, " ").trim();
    if (plain && !plain.startsWith("{") && plain.length < 240) return plain;
    return "Gecersiz veri (422). Sicaklik sayi olmali; sayfayi yenileyip tekrar deneyin.";
  }
  if (status === 503) {
    return "MQTT henuz baglanmadi. Birkac saniye bekleyip tekrar deneyin.";
  }
  const trimmed = body.replace(/\s+/g, " ").trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed || `HTTP ${status}`;
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<void> {
  const json = JSON.stringify(body);
  const r = await fetch(getBridgeApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(shortActionError(r.status, t));
  }
}

/** /api/entry ve /api/exit gibi gövdesiz uçlar */
async function apiPostEmpty(path: string): Promise<void> {
  const r = await fetch(getBridgeApiUrl(path), { method: "POST" });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(shortActionError(r.status, t));
  }
}

function thresholdsFromPayload(p: ControllerStatePayload): ThresholdInfo {
  return {
    onC: Number(p.fire_temp_on_c ?? 60),
    offC: Number(p.fire_temp_off_c ?? 55),
    debounceOnSec: Number(p.fire_temp_on_debounce_sec ?? 0),
    debounceOffSec: Number(p.fire_temp_off_debounce_sec ?? 0),
  };
}

function isFireEmergency(p: ControllerStatePayload): boolean {
  const reason = String(p.last_emergency_reason ?? "").toLowerCase();
  const emg =
    p.emergency === true ||
    p.emergency === 1 ||
    String(p.emergency).toLowerCase() === "true";
  return emg && reason === "fire";
}

function showFireBanner(p: ControllerStatePayload): boolean {
  return isFireEmergency(p);
}

export function useLiveDashboard(enabled: boolean) {
  const [payload, setPayload] = useState<ControllerStatePayload | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const lastSemantic = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      setConnectionError(null);
      setActionError(null);
      return;
    }

    let closed = false;
    let reconnect: ReturnType<typeof setTimeout> | undefined;

    const connectWs = () => {
      if (closed) return;
      const wsUrl = getBridgeWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (closed) return;
        setConnectionError(null);
        setActionError(null);
        setConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            type?: string;
            payload?: ControllerStatePayload;
          };
          if (msg.type !== "state" || !msg.payload) return;
          const p = normalizeControllerPayload(
            msg.payload as ControllerStatePayload,
          );
          setActionError(null);
          setPayload(p);
          setChart((c) => {
            const occ =
              p.occupancy !== undefined && p.occupancy !== null
                ? p.occupancy
                : 0;
            const last = c[c.length - 1];
            if (last && last.occupancy === occ) return c;
            return appendOccupancyPoint(c, occ);
          });
          setHistory((prev) => {
            const { rows, semantic } = appendHistoryDistinct(
              prev,
              p,
              lastSemantic.current,
            );
            lastSemantic.current = semantic;
            return rows;
          });
        } catch (err) {
          console.error("[dashboard] WebSocket state islenemedi:", err);
        }
      };

      ws.onerror = () => {
        if (!closed) {
          setConnectionError(`Baglanamadi: ${wsUrl}`);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closed) return;
        setConnected(false);
        reconnect = window.setTimeout(connectWs, 2000);
      };
    };

    const boot = async () => {
      try {
        const r = await fetch(getBridgeApiUrl("/api/history"));
        if (r.ok && !closed) {
          const data = (await r.json()) as {
            rows: HistoryRow[];
            lastSemantic: string | null;
          };
          setHistory(data.rows ?? []);
          lastSemantic.current = data.lastSemantic ?? null;
        }
      } catch {
        /* köprü kapalıysa WebSocket zaten hata verir */
      }
      if (!closed) connectWs();
    };

    void boot();

    return () => {
      closed = true;
      if (reconnect) window.clearTimeout(reconnect);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled]);

  const temperature = safeTempC(payload?.temperature_c ?? 0);
  const occupancy =
    payload?.occupancy !== undefined && payload?.occupancy !== null
      ? payload.occupancy
      : 0;
  const thresholds = payload ? thresholdsFromPayload(payload) : null;
  const fireLatched = payload ? isFireEmergency(payload) : false;
  const bannerVisible = payload ? showFireBanner(payload) : false;

  const increaseTemp = useCallback(async () => {
    const next = safeTempC(Math.max(0, temperature + 5));
    try {
      setActionError(null);
      await apiPost("/api/telemetry", {
        temperature_c: next,
        timestamp: isoNow(),
        room_id: ROOM_ID,
        source: "react_dashboard",
        confidence: 1.0,
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Istek basarisiz");
    }
  }, [temperature]);

  const decreaseTemp = useCallback(async () => {
    const next = safeTempC(Math.max(0, temperature - 5));
    try {
      setActionError(null);
      await apiPost("/api/telemetry", {
        temperature_c: next,
        timestamp: isoNow(),
        room_id: ROOM_ID,
        source: "react_dashboard",
        confidence: 1.0,
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Istek basarisiz");
    }
  }, [temperature]);

  const resetEmergency = useCallback(async () => {
    try {
      setActionError(null);
      await fetch(getBridgeApiUrl("/api/history"), { method: "DELETE" });
      await apiPost("/api/control", {
        event_type: "reset",
        timestamp: isoNow(),
        room_id: ROOM_ID,
        source: "react_dashboard",
        confidence: 1.0,
      });
      await apiPost("/api/telemetry", {
        temperature_c: 0,
        timestamp: isoNow(),
        room_id: ROOM_ID,
        source: "react_dashboard_reset",
        confidence: 1.0,
      });
      setChart([]);
      setHistory([]);
      lastSemantic.current = null;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Istek basarisiz");
    }
  }, []);

  const roomCapacity = Number(payload?.room_capacity ?? 10);
  const capForPeak = Number.isFinite(roomCapacity) ? roomCapacity : 10;
  const { peakOccupancyThreshold, occupancyLoad } = derivePeakAndLoad(
    payload,
    occupancy,
    capForPeak,
  );

  const addPerson = useCallback(async () => {
    if (payload != null && isFireEmergency(payload)) return;
    if (Number.isFinite(roomCapacity) && occupancy >= roomCapacity) return;
    try {
      setActionError(null);
      await apiPostEmpty("/api/entry");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Istek basarisiz");
    }
  }, [payload, occupancy, roomCapacity]);

  const removePerson = useCallback(async () => {
    if (payload != null && isFireEmergency(payload)) return;
    if (occupancy <= 0) return;
    try {
      setActionError(null);
      await apiPostEmpty("/api/exit");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Istek basarisiz");
    }
  }, [payload, occupancy]);

  const clearHistory = useCallback(async () => {
    try {
      await fetch(getBridgeApiUrl("/api/history"), { method: "DELETE" });
    } catch {
      /* */
    }
    setHistory([]);
    lastSemantic.current = null;
  }, []);

  return {
    temperature,
    occupancy,
    roomCapacity: Number.isFinite(roomCapacity) ? roomCapacity : 10,
    peakOccupancyThreshold,
    occupancyLoad,
    fireLatched,
    bannerVisible,
    chart,
    history,
    thresholds,
    connected,
    connectionError,
    actionError,
    increaseTemp,
    decreaseTemp,
    resetEmergency,
    addPerson,
    removePerson,
    clearHistory,
  };
}
