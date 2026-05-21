import { useState } from "react";
import { requestFireNotificationPermission } from "../hooks/useFireDesktopNotification";

type Props = {
  /** Canlı modda göster (demo’da anlamsız) */
  show: boolean;
};

export function FireNotificationPrompt({ show }: Props) {
  const [perm, setPerm] = useState<NotificationPermission>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  if (!show || typeof Notification === "undefined") return null;

  if (perm === "granted") {
    return (
      <p className="text-[11px] text-ink-subtle">
        Yangın masaüstü bildirimi: <span className="text-[#86EFAC]">açık</span>
      </p>
    );
  }

  if (perm === "denied") {
    return (
      <p className="text-[11px] text-ink-subtle">
        Bildirimler tarayıcıda reddedilmiş; adres çubuğundaki kilit simgesinden izin
        verebilirsiniz.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        const p = await requestFireNotificationPermission();
        setPerm(p);
      }}
      className="rounded-lg border border-line bg-night-900/80 px-3 py-2 text-left text-[11px] font-semibold text-indigo-200 transition hover:border-indigo-500/35 hover:bg-night-850"
    >
      Yangın anında masaüstü bildirimi için izin ver
    </button>
  );
}
