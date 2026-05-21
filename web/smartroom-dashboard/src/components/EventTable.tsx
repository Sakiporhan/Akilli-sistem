import { useMemo, useState } from "react";
import type { HistoryRow } from "../types";
import {
  filterHistoryRows,
  type EventCategoryFilter,
  type TimeRangePreset,
} from "../utils/historyFilters";

type Props = {
  rows: HistoryRow[];
  onClear?: () => void | Promise<void>;
  /** Doluluk sütununda yüzde göstermek için (oda kapasitesi). */
  roomCapacity?: number;
};

function occupancyLabel(r: HistoryRow, roomCapacity?: number): string {
  const base = `${r.occupancy} kişi`;
  if (roomCapacity != null && roomCapacity > 0) {
    const pct = Math.min(100, Math.round((r.occupancy / roomCapacity) * 100));
    return `${base} (${pct}%)`;
  }
  return base;
}

function downloadCsv(rows: HistoryRow[], roomCapacity?: number) {
  const cap = roomCapacity != null && roomCapacity > 0 ? roomCapacity : null;
  const header = [
    "ISO_Zaman",
    "Saat",
    "Olay",
    "OlayTipi",
    "Doluluk",
    ...(cap != null ? ["Doluluk_yuzde"] : []),
    "Sicaklik_C",
    "Kaynak",
    "AcilDurum",
    "AcilNeden",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        new Date(r.recordedAtMs).toISOString(),
        r.time,
        `"${r.event.replace(/"/g, '""')}"`,
        r.eventKind,
        r.occupancy,
        ...(cap != null
          ? [String(Math.min(100, Math.round((r.occupancy / cap) * 100)))]
          : []),
        r.temperatureC ?? "",
        `"${(r.source ?? "").replace(/"/g, '""')}"`,
        r.emergency ? "Evet" : "Hayir",
        `"${(r.emergencyReason ?? "").replace(/"/g, '""')}"`,
      ].join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF", lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `olay-gecmisi-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function statusPresentation(row: HistoryRow): { label: string; className: string } {
  if (!row.emergency) {
    return {
      label: "Güvenli",
      className: "bg-[#22C55E]/12 text-[#BBF7D0] ring-1 ring-[#22C55E]/30",
    };
  }
  const reason = (row.emergencyReason || "").toLowerCase();
  if (reason === "fire") {
    return {
      label: "Yangın",
      className: "bg-[#EF4444]/18 text-[#FECACA] ring-1 ring-[#EF4444]/35",
    };
  }
  if (reason === "inactivity") {
    return {
      label: "Hareketsizlik",
      className: "bg-[#F59E0B]/12 text-[#FDE68A] ring-1 ring-[#F59E0B]/30",
    };
  }
  return {
    label: "Acil",
    className: "bg-[#F43F5E]/12 text-[#FECDD3] ring-1 ring-[#F43F5E]/30",
  };
}

const CATEGORY_OPTIONS: { value: EventCategoryFilter; label: string }[] = [
  { value: "all", label: "Tüm olaylar" },
  { value: "entry", label: "Kişi girişi" },
  { value: "exit", label: "Kişi çıkışı" },
  { value: "fire", label: "Yangın" },
  { value: "reset", label: "Sıfırlama" },
  { value: "inactivity", label: "Hareketsizlik" },
  { value: "idle", label: "Beklemede" },
  { value: "emergency_only", label: "Sadece acil" },
  { value: "safe_only", label: "Sadece güvenli" },
];

const TIME_OPTIONS: { value: TimeRangePreset; label: string }[] = [
  { value: "all", label: "Tüm zamanlar" },
  { value: "15m", label: "Son 15 dk" },
  { value: "1h", label: "Son 1 saat" },
  { value: "today", label: "Bugün (yerel saat)" },
];

const inputClass =
  "w-full rounded-lg border border-line bg-night-900 px-3 py-2 text-sm text-white placeholder:text-ink-subtle focus:border-brand-hoverFrom/50 focus:outline-none focus:ring-1 focus:ring-brand-to/35";

export function EventTable({ rows, onClear, roomCapacity }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategoryFilter>("all");
  const [timePreset, setTimePreset] = useState<TimeRangePreset>("all");

  const filtered = useMemo(
    () => filterHistoryRows(rows, search, category, timePreset),
    [rows, search, category, timePreset],
  );

  const display = useMemo(() => [...filtered].reverse(), [filtered]);
  const total = rows.length;
  const shown = filtered.length;

  const filtersActive =
    search.trim() !== "" || category !== "all" || timePreset !== "all";

  return (
    <div className="rounded-xl border border-line bg-night-850 p-5 shadow-card backdrop-blur-sm transition hover:border-white/10">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300">
            Olay geçmişi
          </p>
          <p className="mt-1 text-xs text-ink-subtle">
            Giriş/çıkış ve önemli durumlar (en fazla 50). Canlıda MQTT köprüsü; demoda yerel
            simülasyon + otomatik doluluk adımları. En yeni üstte.
          </p>
          <p className="mt-1 text-[11px] font-medium text-ink-muted">
            {total === 0
              ? "Kayıt yok"
              : shown === total
                ? `${total} kayıt`
                : `${shown} / ${total} kayıt (filtreli)`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {onClear ? (
            <button
              type="button"
              disabled={total === 0}
              onClick={onClear}
              className="rounded-lg border border-line bg-night-900 px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-white/12 hover:bg-night-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Listeyi temizle
            </button>
          ) : null}
          <button
            type="button"
            disabled={shown === 0}
            onClick={() => downloadCsv(filtered, roomCapacity)}
            className="rounded-lg bg-gradient-to-r from-brand-from to-brand-to px-3 py-2 text-xs font-semibold text-white shadow-md shadow-black/25 transition hover:from-brand-hoverFrom hover:to-brand-hoverTo disabled:cursor-not-allowed disabled:opacity-40"
          >
            CSV indir (görünen)
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-night-900/50 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-[200px]">
          <label
            htmlFor="hist-search"
            className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-subtle"
          >
            Ara
          </label>
          <input
            id="hist-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Olay, kaynak, doluluk, sıcaklık…"
            className={inputClass}
          />
        </div>
        <div className="w-full sm:w-auto sm:min-w-[160px]">
          <label
            htmlFor="hist-cat"
            className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-subtle"
          >
            Olay tipi
          </label>
          <select
            id="hist-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategoryFilter)}
            className={inputClass}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[160px]">
          <label
            htmlFor="hist-time"
            className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-subtle"
          >
            Zaman
          </label>
          <select
            id="hist-time"
            value={timePreset}
            onChange={(e) => setTimePreset(e.target.value as TimeRangePreset)}
            className={inputClass}
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!filtersActive}
          onClick={() => {
            setSearch("");
            setCategory("all");
            setTimePreset("all");
          }}
          className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Filtreleri sıfırla
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg ring-1 ring-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-indigo-300">
              <th className="px-3 py-3 font-bold">Saat</th>
              <th className="px-3 py-3 font-bold">Olay</th>
              <th className="px-3 py-3 font-bold">Doluluk / oran</th>
              <th className="hidden px-3 py-3 font-bold sm:table-cell">°C</th>
              <th className="hidden px-3 py-3 font-bold md:table-cell">Kaynak</th>
              <th className="px-3 py-3 font-bold">Durum</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {total === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-ink-subtle">
                  Henüz kayıt yok. Giriş/çıkış, sıcaklık veya yangın senaryosu ile olay
                  oluşturun; canlı modda köprüden gelen state burada birikir.
                </td>
              </tr>
            ) : shown === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-ink-subtle">
                  Filtre veya aramaya uyan kayıt yok. Filtreleri sıfırlamayı deneyin.
                </td>
              </tr>
            ) : (
              display.map((r) => {
                const st = statusPresentation(r);
                const fireRow =
                  r.emergency && (r.emergencyReason || "").toLowerCase() === "fire";
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-line transition hover:bg-white/[0.03] ${
                      fireRow ? "bg-[#EF4444]/6" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-ink-subtle">{r.time}</td>
                    <td className="px-3 py-3 font-medium text-white">{r.event}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-muted">
                      {occupancyLabel(r, roomCapacity)}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-ink-subtle sm:table-cell">
                      {r.temperatureC !== undefined ? `${r.temperatureC}°C` : "—"}
                    </td>
                    <td
                      className="hidden max-w-[160px] truncate px-3 py-3 text-xs text-ink-subtle md:table-cell"
                      title={r.source}
                    >
                      {r.source?.trim() ? r.source : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${st.className}`}
                      >
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
