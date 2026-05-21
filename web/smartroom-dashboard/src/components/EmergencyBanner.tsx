type Props = {
  visible: boolean;
};

export function EmergencyBanner({ visible }: Props) {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-rose-400/35 bg-gradient-to-r from-rose-500/20 to-pink-500/15 px-4 py-3 text-sm font-semibold text-rose-100 shadow-lg shadow-black/20 ring-1 ring-rose-500/25">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/25 text-base font-black text-rose-200">
        !
      </span>
      <span className="flex-1">
        UYARI: Yangın Algılandı! Tahliye işlemlerini başlatın.
      </span>
      <button
        type="button"
        className="text-xs font-bold uppercase tracking-wider text-rose-200 underline-offset-2 hover:text-white hover:underline"
      >
        Ayrıntılar
      </button>
    </div>
  );
}
