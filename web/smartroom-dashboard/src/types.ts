export type HistoryRow = {
  id: string;
  time: string;
  event: string;
  occupancy: number;
  emergency: boolean;
  /** Filtre ve sıralama için (payload.updated_at veya oluşturulma anı) */
  recordedAtMs: number;
  /** Normalize olay tipi: entry | exit | fire | reset | idle | inactivity | … */
  eventKind: string;
  /** MQTT last_event_source */
  source?: string;
  /** Köprünün birleştirdiği sıcaklık (°C) */
  temperatureC?: number;
  /** MQTT last_emergency_reason (fire, inactivity, …) */
  emergencyReason?: string;
  /** Köprü kalıcı günlük / senkron (WebSocket dedup ile aynı anahtar) */
  semanticKey?: string;
};

/** GET /api/health yanıtı */
export type BridgeHealth = {
  status: string;
  mqtt_connected: boolean;
  websocket_clients: number;
  seconds_since_last_broadcast: number | null;
};

export type ChartPoint = {
  label: string;
  occupancy: number;
  ts: number;
};

export type ChartRange = "1h" | "24h";

/** MQTT `building/.../state` + köprünün eklediği `temperature_c` */
export type ControllerStatePayload = {
  room_capacity?: number;
  room_id?: string;
  occupancy?: number;
  emergency?: boolean | number | string;
  last_emergency_reason?: string;
  last_event_type?: string;
  last_event_source?: string;
  last_event_confidence?: number;
  updated_at?: string;
  fire_temp_on_c?: number;
  fire_temp_off_c?: number;
  fire_temp_on_debounce_sec?: number;
  fire_temp_off_debounce_sec?: number;
  temperature_c?: number;
  /** Kontrolcü: yoğunluk eşiği (oda kapasitesine kısıtlanır). */
  peak_occupancy_threshold?: number;
  /** Kontrolcü: doluluk eşik karşılaştırması — normal | peak */
  occupancy_load?: "normal" | "peak";
};

export type ThresholdInfo = {
  onC: number;
  offC: number;
  debounceOnSec: number;
  debounceOffSec: number;
};

export const THRESHOLD_ON_C = 60;
export const THRESHOLD_OFF_C = 55;
export const DEBOUNCE_ON_SEC = 0;
export const DEBOUNCE_OFF_SEC = 0;
