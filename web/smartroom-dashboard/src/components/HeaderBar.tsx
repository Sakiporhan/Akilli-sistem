export type HeaderTab = "dashboard" | "sim" | "history" | "settings";

type Props = {
  activeTab: HeaderTab;
  onTabChange?: (t: HeaderTab) => void;
};

const tabs: { id: HeaderTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sim", label: "Simülasyon" },
  { id: "history", label: "Geçmiş" },
  { id: "settings", label: "Ayarlar" },
];

export function HeaderBar({ activeTab, onTabChange }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          Akıllı Oda Dashboard
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Gerçek zamanlı yangın ve doluluk takibi
        </p>
        <nav className="mt-4 flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange?.(t.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                activeTab === t.id
                  ? "bg-gradient-to-r from-brand-from/35 to-brand-to/35 text-white ring-1 ring-line shadow-sm"
                  : "text-ink-muted hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4 text-ink-muted">
        <button
          type="button"
          className="rounded-lg p-2 transition hover:bg-white/[0.04] hover:text-white"
          aria-label="Bildirimler"
        >
          🔔
        </button>
        <button
          type="button"
          className="rounded-lg p-2 transition hover:bg-white/[0.04] hover:text-white"
          aria-label="Ayarlar"
        >
          ⚙️
        </button>
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-hoverFrom to-[#F97316] ring-2 ring-line" />
      </div>
    </header>
  );
}
