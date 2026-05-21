type Props = {
  onIncrease: () => void;
  onDecrease: () => void;
  onReset: () => void;
  onEntry: () => void;
  onExit: () => void;
  /** Yangın acil durumunda giriş/çıkış kontrolcüde yok sayılır */
  occupancyFireBlocked: boolean;
  occupancyAtCapacity: boolean;
  occupancyIsEmpty: boolean;
};

export function ControlPanel({
  onIncrease,
  onDecrease,
  onReset,
  onEntry,
  onExit,
  occupancyFireBlocked,
  occupancyAtCapacity,
  occupancyIsEmpty,
}: Props) {
  const entryDisabled = occupancyFireBlocked || occupancyAtCapacity;
  const exitDisabled = occupancyFireBlocked || occupancyIsEmpty;

  return (
    <div className="rounded-xl border border-line bg-night-850 p-6 shadow-card backdrop-blur-sm transition hover:border-white/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300">
        Kontrol Paneli
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onIncrease}
          className="min-h-[48px] flex-1 rounded-xl bg-gradient-to-r from-brand-from to-brand-to px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:from-brand-hoverFrom hover:to-brand-hoverTo hover:shadow-[#7C3AED]/25 active:scale-[0.98]"
        >
          Sıcaklık +5°C
        </button>
        <button
          type="button"
          onClick={onDecrease}
          className="min-h-[48px] flex-1 rounded-xl border border-line bg-night-900 px-5 py-3 text-sm font-semibold text-ink-muted transition hover:border-white/12 hover:bg-night-800 hover:text-white active:scale-[0.98]"
        >
          Sıcaklık −5°C
        </button>
        <button
          type="button"
          onClick={onReset}
          className="min-h-[52px] w-full rounded-xl bg-gradient-to-r from-[#E11D48] to-[#BE123C] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#BE123C]/30 transition hover:brightness-110 active:scale-[0.98] sm:w-full"
        >
          Acil Durumu Sıfırla
        </button>
      </div>

      <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300">
        Doluluk simülasyonu
      </p>
      <p className="mt-1 text-xs text-ink-subtle">
        Odaya giren / çıkan kişi sayısını tek tek MQTT olayı olarak gönderir. Yangında doluluk
        sıfırlanır; acil sıfırlamada grafik ve sayaç başa döner.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onEntry}
          disabled={entryDisabled}
          className="min-h-[48px] flex-1 rounded-xl border border-indigo-500/25 bg-night-900/60 px-5 py-3 text-sm font-semibold text-ink-muted transition hover:border-indigo-400/35 hover:bg-night-800 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Kişi girdi (+1)
        </button>
        <button
          type="button"
          onClick={onExit}
          disabled={exitDisabled}
          className="min-h-[48px] flex-1 rounded-xl border border-line bg-night-900 px-5 py-3 text-sm font-semibold text-ink-muted transition hover:border-white/12 hover:bg-night-800 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Kişi çıktı (−1)
        </button>
      </div>
    </div>
  );
}
