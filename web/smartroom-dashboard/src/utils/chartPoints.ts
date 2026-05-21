import type { ChartPoint } from "../types";

export function appendOccupancyPoint(chart: ChartPoint[], occupancy: number): ChartPoint[] {
  const t = new Date();
  const label = t.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const point: ChartPoint = { label, occupancy, ts: t.getTime() };
  return [...chart, point].slice(-60);
}
