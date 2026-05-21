import { useCallback, useState } from "react";
import { getBridgeApiUrl, getBridgeHttpOrigin, getBridgeWsUrl } from "../config/bridge";
import { requestFireNotificationPermission } from "../hooks/useFireDesktopNotification";

const ROOM_ID = import.meta.env.VITE_ROOM_ID ?? "room1";
const PEAK_ENV = import.meta.env.VITE_PEAK_OCCUPANCY_THRESHOLD as string | undefined;
const BRIDGE_ORIGIN_RAW = import.meta.env.VITE_BRIDGE_ORIGIN as string | undefined;
const BRIDGE_PORT_RAW = import.meta.env.VITE_BRIDGE_PORT as string | undefined;

type Props = {
  demoMode: boolean;
  connected: boolean;
  connectionError: string | null;
};

function envCell(raw: string | undefined): string {
  if (raw != null && String(raw).trim() !== "") return String(raw).trim();
  return "— (tanımsız)";
}

export function SettingsPanel({ demoMode, connected, connectionError }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  const httpOrigin = getBridgeHttpOrigin();
  const wsUrl = getBridgeWsUrl();
  const healthUrl = getBridgeApiUrl("/api/health");

  const httpSummary =
    httpOrigin === ""
      ? import.meta.env.DEV
        ? "Geliştirmede HTTP istekleri bu sayfanın adresi üzerinden /api yoluna gider (Vite proxy → köprü)."
        : "HTTP istekleri sayfa ile aynı sunucudan göreli /api yollarına gider."
      : `Doğrudan köprü: ${httpOrigin}`;

  const copyText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  }, []);

  const CopyBtn = ({ k, text }: { k: string; text: string }) => (
    <button
      type="button"
      onClick={() => copyText(k, text)}
      className="shrink-0 rounded-md border border-line px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-200 transition hover:border-indigo-500/40"
    >
      {copiedKey === k ? "Kopyalandı" : "Kopyala"}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Ayarlar</h2>
        <p className="mt-1 text-sm text-ink-subtle">
          Köprü adresi ve oda kimliği çoğunlukla{" "}
          <code className="rounded bg-night-900 px-1 py-0.5 text-indigo-300">.env</code> ile
          verilir; dosyayı değiştirdikten sonra geliştirme sunucusunu yeniden başlatın.
        </p>
      </div>

      <section className="rounded-xl border border-line bg-night-850/80 p-5">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-300">
          Bağlantı durumu
        </h3>
        {demoMode ? (
          <p className="mt-3 text-sm text-ink-muted">
            <span className="font-semibold text-indigo-200">Demo modu</span> — WebSocket ve MQTT
            köprüsü kullanılmıyor. Canlı deneme için adres çubuğundan{" "}
            <code className="rounded bg-night-900 px-1 text-indigo-300">demo=1</code> kaldırın.
          </p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-ink-subtle">WebSocket:</span>
              {connected ? (
                <span className="font-semibold text-emerald-300">Bağlı</span>
              ) : (
                <span className="font-semibold text-amber-300">Bağlantı yok</span>
              )}
            </p>
            {connectionError ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {connectionError}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-night-850/80 p-5">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-300">
          Köprü uçları (efektif)
        </h3>
        <p className="mt-2 text-sm text-ink-muted">{httpSummary}</p>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              Örnek REST
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-lg bg-night-950 px-2 py-1.5 text-xs text-sky-200">
                {healthUrl}
              </code>
              <CopyBtn k="health" text={healthUrl} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
              WebSocket
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-lg bg-night-950 px-2 py-1.5 text-xs text-sky-200">
                {wsUrl}
              </code>
              <CopyBtn k="ws" text={wsUrl} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-night-850/80 p-5">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-300">
          Ortam değişkenleri (derleme)
        </h3>
        <p className="mt-2 text-xs text-ink-subtle">
          Kaynak: <code className="text-indigo-300">.env</code> — şablon için projedeki{" "}
          <code className="text-indigo-300">.env.example</code> dosyasına bakın.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-subtle">
                <th className="py-2 pr-4 font-bold">Değişken</th>
                <th className="py-2 font-bold">Değer</th>
              </tr>
            </thead>
            <tbody className="text-ink-muted">
              <tr className="border-b border-line/70">
                <td className="py-2 pr-4 font-mono text-xs text-indigo-200/90">
                  VITE_BRIDGE_ORIGIN
                </td>
                <td className="py-2 font-mono text-xs">{envCell(BRIDGE_ORIGIN_RAW)}</td>
              </tr>
              <tr className="border-b border-line/70">
                <td className="py-2 pr-4 font-mono text-xs text-indigo-200/90">
                  VITE_BRIDGE_PORT
                </td>
                <td className="py-2 font-mono text-xs">
                  {BRIDGE_PORT_RAW != null && String(BRIDGE_PORT_RAW).trim() !== ""
                    ? String(BRIDGE_PORT_RAW).trim()
                    : "8765 (varsayılan, WS geliştirmede)"}
                </td>
              </tr>
              <tr className="border-b border-line/70">
                <td className="py-2 pr-4 font-mono text-xs text-indigo-200/90">VITE_ROOM_ID</td>
                <td className="py-2 font-mono text-xs">{ROOM_ID}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-xs text-indigo-200/90">
                  VITE_PEAK_OCCUPANCY_THRESHOLD
                </td>
                <td className="py-2 font-mono text-xs">
                  {PEAK_ENV != null && String(PEAK_ENV).trim() !== ""
                    ? String(PEAK_ENV).trim()
                    : "— (MQTT / sunucu eşiği kullanılır)"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-night-850/80 p-5">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-300">
          Yangın masaüstü bildirimi
        </h3>
        <p className="mt-2 text-sm text-ink-muted">
          Canlı modda yangın bandı göründüğünde tarayıcı bildirimi gönderilir (izin verilmişse).
        </p>
        {typeof Notification === "undefined" ? (
          <p className="mt-3 text-xs text-ink-subtle">Bu tarayıcı bildirimleri desteklemiyor.</p>
        ) : notifPerm === "granted" ? (
          <p className="mt-3 text-sm text-emerald-300">İzin verildi.</p>
        ) : notifPerm === "denied" ? (
          <p className="mt-3 text-xs text-ink-subtle">
            Bildirimler reddedilmiş. Adres çubuğundaki kilit veya site ayarlarından izni
            açabilirsiniz.
          </p>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const p = await requestFireNotificationPermission();
              setNotifPerm(p);
            }}
            className="mt-3 rounded-lg border border-line bg-night-900/80 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:border-indigo-500/35 hover:bg-night-850"
          >
            Bildirim izni iste
          </button>
        )}
      </section>
    </div>
  );
}
