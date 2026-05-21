type Props = {
  count: number;
  capacity?: number;
  /** Doluluk >= bu kişi sayısı → "Yoğun saat"; altında → "Normal gün" */
  peakThreshold: number;
  load: "normal" | "peak";
};

export function OccupancyCard({ count, capacity = 10, peakThreshold, load }: Props) {
  const pct = Math.min(100, Math.round((count / capacity) * 100));
  const isPeak = load === "peak";

  return (
    <div className="rounded-xl border border-line bg-night-850 p-5 shadow-card backdrop-blur-sm transition hover:border-white/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300">
        Oda Doluluk
      </p>
      <p className="mt-3 text-3xl font-bold text-white">
        {count} <span className="text-lg font-semibold text-ink-muted">kişi</span>
      </p>

      <div
        className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ring-1 ${
          isPeak
            ? "bg-[#F59E0B]/12 text-[#FDE68A] ring-[#F59E0B]/30"
            : "bg-night-900/80 text-ink-muted ring-line"
        }`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isPeak
              ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]"
              : "bg-[#22C55E]"
          }`}
        />
        {isPeak ? "Yoğun saat" : "Normal gün"}
        <span className="font-normal text-ink-subtle">· eşik ≥{peakThreshold} kişi</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-night-900">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isPeak
              ? "bg-gradient-to-r from-amber-500 to-orange-500"
              : "bg-gradient-to-r from-chart-primary to-chart-secondary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
