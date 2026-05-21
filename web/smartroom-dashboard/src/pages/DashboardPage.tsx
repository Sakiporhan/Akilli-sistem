import { useMemo, useState } from "react";
import { ActionErrorBanner } from "../components/ActionErrorBanner";
import { ConnectionStatus } from "../components/ConnectionStatus";
import { ControlPanel } from "../components/ControlPanel";
import { EmergencyBanner } from "../components/EmergencyBanner";
import { EventTable } from "../components/EventTable";
import { HeaderBar, type HeaderTab } from "../components/HeaderBar";
import { OccupancyCard } from "../components/OccupancyCard";
import { OccupancyChart } from "../components/OccupancyChart";
import { Sidebar } from "../components/Sidebar";
import { StatusCard } from "../components/StatusCard";
import { TemperatureCard } from "../components/TemperatureCard";
import { ThresholdCard } from "../components/ThresholdCard";
import { FireNotificationPrompt } from "../components/FireNotificationPrompt";
import { SettingsPanel } from "../components/SettingsPanel";
import { useBridgeHealth } from "../hooks/useBridgeHealth";
import { useFireDesktopNotification } from "../hooks/useFireDesktopNotification";
import { useLiveDashboard } from "../hooks/useLiveDashboard";
import { useSmartRoomSimulation } from "../hooks/useSmartRoomSimulation";
import { SIM_ROOM_CAPACITY, thresholdDisplay } from "../state/simulation";
import type { ThresholdInfo } from "../types";
import { derivePeakAndLoad } from "../utils/occupancyLoad";

const defaultThresholds: ThresholdInfo = {
  onC: 60,
  offC: 55,
  debounceOnSec: 0,
  debounceOffSec: 0,
};

function setQueryParamAndReload(key: string, value: string | null) {
  const u = new URL(window.location.href);
  if (value == null || value === "") u.searchParams.delete(key);
  else u.searchParams.set(key, value);
  window.location.href = u.toString();
}

export function DashboardPage() {
  const [tab, setTab] = useState<HeaderTab>("dashboard");
  const demoMode = useMemo(
    () => new URLSearchParams(window.location.search).get("demo") === "1",
    [],
  );

  const mock = useSmartRoomSimulation(demoMode);
  const live = useLiveDashboard(!demoMode);

  const temperature = demoMode ? mock.state.temperature : live.temperature;
  const occupancy = demoMode ? mock.state.occupancy : live.occupancy;
  const fireStatus = demoMode ? mock.state.fireLatched : live.fireLatched;
  const showBanner = demoMode ? mock.state.fireLatched : live.bannerVisible;
  const chart = demoMode ? mock.state.chart : live.chart;
  const history = demoMode ? mock.state.history : live.history;
  const thresholds = demoMode ? thresholdDisplay : live.thresholds ?? defaultThresholds;
  const increaseTemp = demoMode ? mock.increaseTemp : live.increaseTemp;
  const decreaseTemp = demoMode ? mock.decreaseTemp : live.decreaseTemp;
  const resetEmergency = demoMode ? mock.resetEmergency : live.resetEmergency;
  const addPerson = demoMode ? mock.addPerson : live.addPerson;
  const removePerson = demoMode ? mock.removePerson : live.removePerson;
  const clearHistory = demoMode ? mock.clearHistory : live.clearHistory;
  const roomCapacity = demoMode ? SIM_ROOM_CAPACITY : live.roomCapacity;
  const { peakOccupancyThreshold, occupancyLoad } = demoMode
    ? derivePeakAndLoad(null, occupancy, SIM_ROOM_CAPACITY)
    : { peakOccupancyThreshold: live.peakOccupancyThreshold, occupancyLoad: live.occupancyLoad };
  const connected = demoMode ? true : live.connected;
  const connectionError = demoMode ? null : live.connectionError;
  const actionError = demoMode ? null : live.actionError;

  const bridgeHealth = useBridgeHealth(!demoMode);
  useFireDesktopNotification(showBanner, !demoMode);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-night-950 via-night-900 to-night-850 text-white">
      <div className="hidden lg:block lg:shrink-0">
        <Sidebar
          activeTab={tab}
          onNavigate={setTab}
          demoMode={demoMode}
          connected={connected}
          bridgeHealth={demoMode ? null : bridgeHealth}
          fireActive={fireStatus}
          temperature={temperature}
          occupancy={occupancy}
        />
      </div>
      <div className="flex min-h-screen flex-1 flex-col lg:border-l lg:border-line">
        <div className="border-b border-line lg:hidden">
          <Sidebar
            activeTab={tab}
            onNavigate={setTab}
            demoMode={demoMode}
            connected={connected}
            bridgeHealth={demoMode ? null : bridgeHealth}
            fireActive={fireStatus}
            temperature={temperature}
            occupancy={occupancy}
          />
        </div>
        <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <ConnectionStatus
              demoMode={demoMode}
              connected={connected}
              connectionError={connectionError}
              bridgeHealth={demoMode ? null : bridgeHealth}
            />
            <FireNotificationPrompt show={!demoMode} />
            <ActionErrorBanner message={actionError} />
            <EmergencyBanner visible={showBanner} />
            <HeaderBar activeTab={tab} onTabChange={setTab} />

            {tab === "dashboard" && (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatusCard isFire={fireStatus} />
                  <TemperatureCard celsius={temperature} />
                  <OccupancyCard
                    count={occupancy}
                    capacity={roomCapacity}
                    peakThreshold={peakOccupancyThreshold}
                    load={occupancyLoad}
                  />
                  <ThresholdCard
                    onC={thresholds.onC}
                    offC={thresholds.offC}
                    debounceOnSec={thresholds.debounceOnSec}
                    debounceOffSec={thresholds.debounceOffSec}
                    peakOccupancyThreshold={peakOccupancyThreshold}
                  />
                </section>

                <ControlPanel
                  onIncrease={increaseTemp}
                  onDecrease={decreaseTemp}
                  onReset={resetEmergency}
                  onEntry={addPerson}
                  onExit={removePerson}
                  occupancyFireBlocked={showBanner}
                  occupancyAtCapacity={occupancy >= roomCapacity}
                  occupancyIsEmpty={occupancy <= 0}
                />

                <OccupancyChart data={chart} />
                <EventTable
                  rows={history}
                  onClear={clearHistory}
                  roomCapacity={roomCapacity ?? undefined}
                />
              </>
            )}

            {tab === "history" && (
              <div className="space-y-4">
                <p className="text-sm text-ink-muted">
                  Kartlar ve grafik için{" "}
                  <button
                    type="button"
                    onClick={() => setTab("dashboard")}
                    className="font-semibold text-indigo-300 underline-offset-2 hover:text-indigo-200 hover:underline"
                  >
                    Dashboard
                  </button>{" "}
                  sekmesine geçin. Bu sayfada yalnızca olay listesi gösterilir.
                </p>
                <EventTable
                  rows={history}
                  onClear={clearHistory}
                  roomCapacity={roomCapacity ?? undefined}
                />
              </div>
            )}

            {tab === "sim" && (
              <div className="space-y-6">
                {!demoMode ? (
                  <div className="rounded-xl border border-dashed border-line bg-night-850/80 p-8 md:p-10">
                    <h2 className="text-lg font-semibold text-white">Simülasyon modu</h2>
                    <p className="mt-2 max-w-2xl text-sm text-ink-subtle">
                      MQTT köprüsü olmadan arayüzü denemek için yerel demo kullanılır. Sıcaklık ve
                      doluluk periyodik güncellenir; otomatik ve elle yapılan giriş/çıkışlar{" "}
                      <strong className="text-ink-muted">Geçmiş</strong> sekmesinde listelenir.
                    </p>
                    <ul className="mt-4 max-w-2xl list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
                      <li>Periyodik tick ile sıcaklık ve rastgele doluluk adımları</li>
                      <li>Elle sıcaklık, kişi ekleme/çıkarma ve yangın sıfırlama</li>
                      <li>Doluluk grafiği ve olay geçmişi CSV indirme</li>
                    </ul>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQueryParamAndReload("demo", "1")}
                        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500"
                      >
                        Demoyu başlat
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("dashboard")}
                        className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:border-indigo-500/40 hover:text-white"
                      >
                        Canlı Dashboard
                      </button>
                    </div>
                    <p className="mt-4 text-xs text-ink-subtle">
                      İsterseniz adres çubuğuna manuel{" "}
                      <code className="rounded bg-night-900 px-1.5 py-0.5 text-indigo-300">
                        ?demo=1
                      </code>{" "}
                      de ekleyebilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-line bg-night-850/80 p-6">
                      <h2 className="text-lg font-semibold text-white">Demo çalışıyor</h2>
                      <p className="mt-2 text-sm text-ink-subtle">
                        Simülasyon yaklaşık her 2,8 saniyede bir ilerler; küçük doluluk değişimleri
                        ve sıcaklık güncellemeleri olay geçmişine yazılır. Kontroller ve grafik{" "}
                        <span className="text-ink-muted">Dashboard</span> sekmesindedir.
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setTab("dashboard")}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                        >
                          Kontroller ve grafik
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab("history")}
                          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-muted hover:border-indigo-500/40 hover:text-white"
                        >
                          Olay geçmişi
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-line bg-night-850/90 p-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-300">
                        Anlık özet
                      </p>
                      <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex justify-between gap-4 border-b border-line/60 pb-3">
                          <dt className="text-ink-subtle">Sıcaklık</dt>
                          <dd className="font-mono font-semibold tabular-nums text-white">
                            {temperature.toFixed(1)} °C
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-b border-line/60 pb-3">
                          <dt className="text-ink-subtle">Doluluk</dt>
                          <dd className="font-mono font-semibold tabular-nums text-white">
                            {occupancy} / {SIM_ROOM_CAPACITY} kişi (
                            {Math.min(
                              100,
                              Math.round((occupancy / SIM_ROOM_CAPACITY) * 100),
                            )}
                            %)
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 border-b border-line/60 pb-3">
                          <dt className="text-ink-subtle">Yangın durumu</dt>
                          <dd className={fireStatus ? "font-semibold text-amber-300" : "text-emerald-300"}>
                            {fireStatus ? "Uyarı (aktif)" : "Normal"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4 pt-1">
                          <dt className="text-ink-subtle">Kayıtlı olay</dt>
                          <dd className="font-mono tabular-nums text-white">{history.length}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="rounded-xl border border-dashed border-line bg-night-900/40 p-4 text-center text-sm text-ink-subtle lg:col-span-2">
                      Demo&apos;dan çıkmak için{" "}
                      <button
                        type="button"
                        onClick={() => setQueryParamAndReload("demo", null)}
                        className="font-semibold text-indigo-300 underline-offset-2 hover:text-indigo-200 hover:underline"
                      >
                        canlı moda dön
                      </button>{" "}
                      veya adres çubuğundan{" "}
                      <code className="rounded bg-night-950 px-1.5 py-0.5 text-indigo-300">
                        demo=1
                      </code>{" "}
                      parametresini kaldırın.
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "settings" && (
              <SettingsPanel
                demoMode={demoMode}
                connected={connected}
                connectionError={connectionError}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
