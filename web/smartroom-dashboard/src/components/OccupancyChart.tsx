import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint, ChartRange } from "../types";

type Props = {
  data: ChartPoint[];
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const FILL_PRIMARY = "#8B5CF6";
const FILL_SECONDARY = "#6366F1";

export function OccupancyChart({ data }: Props) {
  const [range, setRange] = useState<ChartRange>("1h");

  const filtered = useMemo(() => {
    const now = Date.now();
    const windowMs = range === "1h" ? HOUR_MS : DAY_MS;
    const start = now - windowMs;
    return data.filter((d) => d.ts >= start);
  }, [data, range]);

  const chartData = useMemo(
    () =>
      filtered.map((d, i) => ({
        ...d,
        fill: i === filtered.length - 1 ? FILL_PRIMARY : FILL_SECONDARY,
      })),
    [filtered],
  );

  return (
    <div className="rounded-xl border border-line bg-night-850 p-5 shadow-card backdrop-blur-sm transition hover:border-white/10">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300">
            Doluluk Grafiği
          </p>
          <p className="mt-1 text-[11px] text-ink-subtle">
            Yeni çubuk yalnızca kişi sayısı değişince eklenir (sıcaklık grafiği değil).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRange("1h")}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
              range === "1h"
                ? "bg-gradient-to-r from-brand-from/30 to-brand-to/30 text-white ring-1 ring-line"
                : "text-ink-muted hover:bg-white/[0.04]"
            }`}
          >
            Son 1 saat
          </button>
          <button
            type="button"
            onClick={() => setRange("24h")}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
              range === "24h"
                ? "bg-gradient-to-r from-brand-from/30 to-brand-to/30 text-white ring-1 ring-line"
                : "text-ink-muted hover:bg-white/[0.04]"
            }`}
          >
            24 saat
          </button>
        </div>
      </div>
      <div className="h-64 w-full min-w-0 [&_.recharts-wrapper]:!bg-transparent [&_.recharts-surface]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            style={{ background: "transparent" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" opacity={0.35} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#A0AEC0", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
            />
            <YAxis
              tick={{ fill: "#A0AEC0", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              allowDecimals={false}
              domain={[0, 10]}
            />
            <Tooltip
              /* Varsayılan imleç dikdörtgeni açık gri/beyaz — koyu ince vurgu */
              cursor={{ fill: "rgba(139, 92, 246, 0.12)" }}
              contentStyle={{
                background: "#1A2236",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                color: "#F8FAFC",
              }}
              labelStyle={{ color: "#A5B4FC" }}
              itemStyle={{ color: "#E2E8F0" }}
              wrapperStyle={{ outline: "none" }}
            />
            <Bar dataKey="occupancy" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={`${entry.ts}-${i}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
