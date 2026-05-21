import { THRESHOLD_ON_C } from "../types";

type Props = {
  celsius: number;
};

export function TemperatureCard({ celsius }: Props) {
  const normal = celsius < THRESHOLD_ON_C;
  return (
    <div className="rounded-xl border border-line bg-night-850 p-5 shadow-card backdrop-blur-sm transition hover:border-white/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300">
        Anlık Sıcaklık
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">
          {celsius.toFixed(1)}
          <span className="text-lg font-semibold text-violet-300">°C</span>
        </span>
        <span
          className={`text-lg ${normal ? "text-[#22C55E]" : "text-[#F59E0B]"}`}
          aria-hidden
        >
          {normal ? "↓" : "↑"}
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {normal ? "Normal aralıkta" : "Yüksek sıcaklık"}
      </p>
    </div>
  );
}
