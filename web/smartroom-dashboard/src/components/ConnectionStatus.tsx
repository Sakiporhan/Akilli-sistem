import type { BridgeHealth } from "../types";

type Props = {
  demoMode: boolean;
  connected: boolean;
  connectionError: string | null;
  bridgeHealth?: BridgeHealth | null;
};

export function ConnectionStatus({
  demoMode,
  connected,
  connectionError,
  bridgeHealth,
}: Props) {
  if (demoMode) {
    return (
      <div className="rounded-xl border border-sky-500/30 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
        <p>
          <span className="font-semibold text-sky-200">Demo modu</span> — tarayıcıda yerel
          simülasyon; MQTT köprüsü ve kontrolcü{" "}
          <span className="text-sky-300">devre dışı</span> (
          <code className="rounded bg-night-900 px-1 text-sky-200">?demo=1</code>).
        </p>
        <p className="mt-2 text-xs text-sky-200/85">
          Canlı sisteme dönmek için adres çubuğundan{" "}
          <code className="rounded bg-night-900 px-1">?demo=1</code> kısmını silin; köprü +
          kontrolcüyü çalıştırın.
        </p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#FECACA]">
        <span className="font-semibold text-[#F87171]">Bağlantı hatası:</span>{" "}
        {connectionError}
        <div className="mt-2 text-xs text-ink-muted">
          Köprünün çalıştığından emin olun:{" "}
          <code className="text-sky-300">py -m src.dashboard_bridge</code>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="rounded-xl border border-line bg-night-900/80 px-4 py-3 text-sm text-ink-muted">
        Köprüye bağlanılıyor…
      </div>
    );
  }

  const mqttOk = bridgeHealth?.mqtt_connected;
  const age = bridgeHealth?.seconds_since_last_broadcast;

  return (
    <div className="rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-xs font-medium text-[#BBF7D0]">
      <p>Canlı: kontrolcü state akışı bağlı (WebSocket + MQTT köprüsü).</p>
      {bridgeHealth ? (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-[#BBF7D0]/90">
          <li>
            MQTT:{" "}
            {mqttOk ? (
              <span className="text-[#86EFAC]">köprüye bağlı</span>
            ) : (
              <span className="text-[#FDE68A]">bekleniyor veya kopuk</span>
            )}
          </li>
          <li>
            WebSocket istemci: {bridgeHealth.websocket_clients}
            {age != null ? (
              <>
                {" "}
                · son yayın:{" "}
                <span className="tabular-nums">
                  {age > 120 ? `${Math.round(age)} sn` : `${age} sn`}
                </span>{" "}
                önce
              </>
            ) : null}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
