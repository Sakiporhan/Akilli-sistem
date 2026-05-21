type Props = {
  onC: number;
  offC: number;
  debounceOnSec: number;
  debounceOffSec: number;
  /** Doluluk ≥ bu sayıda arayüz "Yoğun saat" gösterir (MQTT / ortam ile uyumlu). */
  peakOccupancyThreshold: number;
};

export function ThresholdCard({
  onC,
  offC,
  debounceOnSec,
  debounceOffSec,
  peakOccupancyThreshold,
}: Props) {
  return (
    <div className="rounded-xl border border-line bg-night-850 p-5 shadow-card backdrop-blur-sm transition hover:border-white/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300">
        Eşik Ayarları
      </p>
      <dl className="mt-4 space-y-2 text-xs">
        <div className="flex justify-between gap-2 text-ink-muted">
          <dt>Yoğunluk eşiği</dt>
          <dd className="font-semibold text-white">
            ≥{peakOccupancyThreshold} kişi → yoğun
          </dd>
        </div>
        <div className="flex justify-between gap-2 text-ink-muted">
          <dt>ON eşiği</dt>
          <dd className="font-semibold text-white">{onC.toFixed(1)}°C</dd>
        </div>
        <div className="flex justify-between gap-2 text-ink-muted">
          <dt>OFF eşiği</dt>
          <dd className="font-semibold text-white">{offC.toFixed(1)}°C</dd>
        </div>
        <div className="flex justify-between gap-2 text-ink-muted">
          <dt>Debounce ON</dt>
          <dd className="font-semibold text-ink-muted">{debounceOnSec}s</dd>
        </div>
        <div className="flex justify-between gap-2 text-ink-muted">
          <dt>Debounce OFF</dt>
          <dd className="font-semibold text-ink-muted">{debounceOffSec}s</dd>
        </div>
      </dl>
    </div>
  );
}
