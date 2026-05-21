import type { ChartPoint, HistoryRow } from "../types";
import {
  DEBOUNCE_OFF_SEC,
  DEBOUNCE_ON_SEC,
  THRESHOLD_OFF_C,
  THRESHOLD_ON_C,
} from "../types";

export const SIM_ROOM_CAPACITY = 10;

export type SimState = {
  temperature: number;
  occupancy: number;
  fireLatched: boolean;
  occupancyBeforeFire: number;
  history: HistoryRow[];
  chart: ChartPoint[];
};

function nextFireLatched(temp: number, prev: boolean): boolean {
  if (temp >= THRESHOLD_ON_C) return true;
  if (temp < THRESHOLD_OFF_C) return false;
  return prev;
}

function timeNow(): string {
  return new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

let idCounter = 0;
function uid(): string {
  idCounter += 1;
  return `e-${Date.now()}-${idCounter}`;
}

function appendHistory(
  rows: HistoryRow[],
  event: string,
  occupancy: number,
  emergency: boolean,
  eventKind: string,
  extra?: Pick<HistoryRow, "source" | "temperatureC" | "emergencyReason">,
): HistoryRow[] {
  const row: HistoryRow = {
    id: uid(),
    time: timeNow(),
    event,
    occupancy,
    emergency,
    recordedAtMs: Date.now(),
    eventKind,
    ...extra,
  };
  const next = [...rows, row];
  return next.slice(-50);
}

function appendChart(chart: ChartPoint[], occupancy: number): ChartPoint[] {
  const t = new Date();
  const label = t.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const point: ChartPoint = { label, occupancy, ts: t.getTime() };
  return [...chart, point].slice(-60);
}

export function createInitialState(): SimState {
  return {
    temperature: 22,
    occupancy: 0,
    fireLatched: false,
    occupancyBeforeFire: 0,
    history: [],
    chart: [],
  };
}

type TransitionOpts = {
  randomizeOccupancy: boolean;
};

export function applyTemperature(
  state: SimState,
  temperature: number,
  opts: TransitionOpts,
): SimState {
  const t = Math.round(temperature * 10) / 10;
  const fireLatched = nextFireLatched(t, state.fireLatched);

  let occupancy = state.occupancy;
  let occupancyBeforeFire = state.occupancyBeforeFire;
  let history = state.history;

  const fireRising = fireLatched && !state.fireLatched;
  const fireFalling = !fireLatched && state.fireLatched;

  if (fireRising) {
    occupancyBeforeFire = occupancy;
    occupancy = 0;
    const fireExtra = {
      temperatureC: t,
      emergencyReason: "fire",
      source: "demo",
    };
    history = appendHistory(history, "Sıcaklık Eşiği Aşıldı", 0, true, "fire", fireExtra);
    history = appendHistory(history, "Oda Terk Edildi", 0, true, "exit", fireExtra);
  } else if (fireFalling) {
    occupancy = 0;
    occupancyBeforeFire = 0;
    history = appendHistory(history, "Sıcaklık Normalleşti", 0, false, "reset", {
      temperatureC: t,
      source: "demo",
    });
  }

  if (fireLatched) {
    occupancy = 0;
  } else if (opts.randomizeOccupancy && !fireRising && !fireFalling) {
    const prevOcc = occupancy;
    const d = Math.random() < 0.34 ? -1 : Math.random() < 0.67 ? 0 : 1;
    const newOcc = Math.max(0, Math.min(SIM_ROOM_CAPACITY, occupancy + d));
    occupancy = newOcc;
    if (d !== 0 && newOcc !== prevOcc) {
      const label = d > 0 ? "Kişi Girişi (otomatik)" : "Kişi Çıkışı (otomatik)";
      const kind = d > 0 ? "entry" : "exit";
      history = appendHistory(history, label, newOcc, false, kind, {
        temperatureC: t,
        source: "demo_oto",
      });
    }
  }

  const chart = appendChart(state.chart, occupancy);

  return {
    ...state,
    temperature: t,
    occupancy,
    fireLatched,
    occupancyBeforeFire,
    history,
    chart,
  };
}

const DEMO_TEMP_MIN = 15;
const DEMO_TEMP_MAX = 85;

/**
 * Periyodik demo tick: doluluk rastgele oynar; sıcaklık da rastgele sürüklenir
 * (ince gürültü + ara sıra daha belirgin sıçrama).
 */
export function tickSimulation(state: SimState): SimState {
  const r = Math.random();
  let delta = (Math.random() - 0.5) * 1.4;
  if (r < 0.12) {
    delta += Math.random() < 0.5 ? 5 + Math.random() * 4 : -(5 + Math.random() * 4);
  } else if (r < 0.22) {
    delta += (Math.random() - 0.5) * 3;
  }
  const next = Math.min(
    DEMO_TEMP_MAX,
    Math.max(DEMO_TEMP_MIN, state.temperature + delta),
  );
  return applyTemperature(state, next, { randomizeOccupancy: true });
}

export function adjustTemperature(state: SimState, delta: number): SimState {
  const temperature = state.temperature + delta;
  return applyTemperature(state, temperature, { randomizeOccupancy: false });
}

/** Elle giriş/çıkış; yangın varken kontrolcü gibi giriş/çıkış yok sayılır. */
export function stepOccupancy(state: SimState, delta: 1 | -1): SimState {
  if (state.fireLatched) return state;
  const next = Math.max(0, Math.min(SIM_ROOM_CAPACITY, state.occupancy + delta));
  if (next === state.occupancy) return state;
  const chart = appendChart(state.chart, next);
  const label = delta > 0 ? "Kişi Girişi" : "Kişi Çıkışı";
  const history = appendHistory(
    state.history,
    label,
    next,
    false,
    delta > 0 ? "entry" : "exit",
    {
      temperatureC: state.temperature,
      source: "demo",
    },
  );
  return { ...state, occupancy: next, chart, history };
}

export function resetSimulation(): SimState {
  return createInitialState();
}

export const thresholdDisplay = {
  onC: THRESHOLD_ON_C,
  offC: THRESHOLD_OFF_C,
  debounceOnSec: DEBOUNCE_ON_SEC,
  debounceOffSec: DEBOUNCE_OFF_SEC,
};
