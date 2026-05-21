type Props = {
  isFire: boolean;
};

export function StatusCard({ isFire }: Props) {
  return (
    <div className="rounded-xl border border-line bg-night-850 p-5 shadow-card backdrop-blur-sm transition hover:border-white/10">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300">
        Yangın Durumu
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isFire
              ? "bg-[#EF4444] shadow-glow-red"
              : "bg-[#22C55E] shadow-glow-emerald"
          }`}
        />
        <span
          className={`text-lg font-bold ${
            isFire ? "text-[#F87171]" : "text-[#4ADE80]"
          }`}
        >
          {isFire ? "Yangın Var" : "Yangın Yok"}
        </span>
        <span
          className={`ml-auto rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isFire
              ? "bg-[#EF4444]/20 text-[#FCA5A5] ring-1 ring-[#EF4444]/35"
              : "bg-[#22C55E]/15 text-[#86EFAC] ring-1 ring-[#22C55E]/30"
          }`}
        >
          {isFire ? "Tehlike" : "Güvenli"}
        </span>
      </div>
    </div>
  );
}
