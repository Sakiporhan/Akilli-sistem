import type { HeaderTab } from "./HeaderBar";
import type { BridgeHealth } from "../types";

const ROOM_ID = import.meta.env.VITE_ROOM_ID ?? "room1";

type NavItem = {
  label: string;
  icon: string;
  tab: HeaderTab;
  /** Aynı sekmeye giden ikinci kısayol (ör. sensör özeti) */
  dashboardAlias?: boolean;
};

const nav: NavItem[] = [
  { label: "Genel Bakış", icon: "◉", tab: "dashboard" },
  { label: "Sensör Verileri", icon: "◎", tab: "dashboard", dashboardAlias: true },
  { label: "Simülatör", icon: "▶", tab: "sim" },
  { label: "Olay Kayıtları", icon: "≡", tab: "history" },
  { label: "Sistem Ayarları", icon: "⚙", tab: "settings" },
];

type Props = {
  activeTab: HeaderTab;
  onNavigate: (tab: HeaderTab) => void;
  demoMode: boolean;
  connected: boolean;
  bridgeHealth: BridgeHealth | null;
  fireActive: boolean;
  temperature: number;
  occupancy: number;
};

export function Sidebar({
  activeTab,
  onNavigate,
  demoMode,
  connected,
  bridgeHealth,
  fireActive,
  temperature,
  occupancy,
}: Props) {
  const demoHref = `${window.location.pathname}?demo=1`;
  const liveHref = `${window.location.pathname}${window.location.hash}`;

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-gradient-to-b from-night-900 to-night-950 p-5 lg:w-72">
      {/* Marka */}
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-from/90 to-brand-to text-sm font-black tracking-tight text-white shadow-lg shadow-brand-to/20 ring-1 ring-white/10">
          IS
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
            Panel Kontrol
          </p>
          <p className="truncate text-lg font-bold text-white">Interlock Systems</p>
          <p className="text-xs font-medium text-indigo-300">Akıllı oda · v2.4</p>
        </div>
      </div>

      {/* Canlı özet */}
      <div className="mt-5 rounded-xl border border-line bg-night-950/50 p-3 ring-1 ring-white/[0.04]">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300/90">
          Oda özeti
        </p>
        <p className="mt-1 truncate text-[11px] text-ink-muted">
          <span className="text-ink-subtle">ID</span>{" "}
          <code className="rounded bg-night-900 px-1 text-indigo-200">{ROOM_ID}</code>
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-night-900/80 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-ink-subtle">Sıcaklık</p>
            <p className="font-semibold tabular-nums text-white">{temperature.toFixed(1)}°C</p>
          </div>
          <div className="rounded-lg bg-night-900/80 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-ink-subtle">Doluluk</p>
            <p className="font-semibold tabular-nums text-white">{occupancy} kişi</p>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 border-t border-line pt-3">
          <StatusRow
            label="Çalışma"
            value={demoMode ? "Demo" : "Canlı"}
            ok={true}
            tone={demoMode ? "neutral" : "ok"}
          />
          {!demoMode ? (
            <>
              <StatusRow
                label="WebSocket"
                value={connected ? "Bağlı" : "Bekleniyor"}
                ok={connected}
              />
              <StatusRow
                label="MQTT köprü"
                value={
                  bridgeHealth == null
                    ? "…"
                    : bridgeHealth.mqtt_connected
                      ? "Bağlı"
                      : "Kopuk"
                }
                ok={bridgeHealth?.mqtt_connected ?? false}
              />
            </>
          ) : (
            <p className="text-[10px] leading-relaxed text-ink-subtle">
              Demo: yerel simülasyon; MQTT yok.
            </p>
          )}
          <StatusRow
            label="Yangın alarmı"
            value={fireActive ? "Aktif" : "Yok"}
            ok={!fireActive}
            fire={fireActive}
          />
        </div>
      </div>

      {/* Menü */}
      <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-subtle">
        Menü
      </p>
      <nav className="flex flex-1 flex-col gap-0.5">
        {nav.map((item) => {
          const highlighted = item.tab === activeTab;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                highlighted
                  ? "bg-gradient-to-r from-brand-from/22 to-brand-to/16 font-semibold text-white ring-1 ring-line"
                  : "text-ink-muted hover:bg-white/[0.04] hover:text-white"
              } ${item.dashboardAlias ? "pl-4 text-[13px]" : ""}`}
            >
              <span className={`shrink-0 ${highlighted ? "opacity-90" : "opacity-60"}`}>
                {item.icon}
              </span>
              <span className="min-w-0">
                {item.label}
                {item.dashboardAlias ? (
                  <span className="mt-0.5 block text-[10px] font-normal text-ink-subtle">
                    Kartlar ve grafikler
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </nav>

      {demoMode ? (
        <div className="mt-4 space-y-2">
          <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 px-3 py-2 text-center text-[11px] text-sky-200/90">
            <p className="font-semibold text-sky-100">Demo simülasyonu çalışıyor</p>
            <p className="mt-1 text-[10px] text-sky-200/75">
              Sıcaklık periyodik olarak rastgele oynar; ±5°C ile de müdahale edebilirsiniz.
              Doluluk da hafif rastgele.
            </p>
          </div>
          <a
            href={liveHref}
            className="block w-full rounded-xl border border-line bg-night-900 py-2.5 text-center text-xs font-semibold text-ink-muted transition hover:border-emerald-500/30 hover:bg-night-850 hover:text-emerald-200"
          >
            Canlı moda dön (MQTT)
          </a>
        </div>
      ) : (
        <a
          href={demoHref}
          title="Yerel demo (?demo=1) — adres çubuğuna eklenir"
          className="mt-4 block w-full rounded-xl border border-line bg-night-900 py-3 text-center text-sm font-semibold text-ink-muted transition hover:border-brand-hoverFrom/35 hover:bg-night-850 hover:text-white"
        >
          Simülasyonu Başlat
        </a>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-night-900/60 p-3 ring-1 ring-line">
        <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-brand-hoverFrom to-[#F97316]" />
        <div className="min-w-0 text-xs">
          <p className="truncate font-semibold text-white">Ahmet Yılmaz</p>
          <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Operatör</p>
        </div>
      </div>
    </aside>
  );
}

function StatusRow({
  label,
  value,
  ok,
  tone = "ok",
  fire = false,
}: {
  label: string;
  value: string;
  ok: boolean;
  tone?: "ok" | "neutral";
  fire?: boolean;
}) {
  const dotClass = fire
    ? "bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.5)]"
    : ok
      ? tone === "neutral"
        ? "bg-sky-400"
        : "bg-[#22C55E]"
      : "bg-amber-400";

  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-ink-subtle">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-white">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
        {value}
      </span>
    </div>
  );
}
