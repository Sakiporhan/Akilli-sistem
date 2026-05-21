import { useEffect, useRef } from "react";

/**
 * Yangın bandı görünürken (kenar tetiklemesi) masaüstü bildirimi.
 * Önce kullanıcıdan Notification.requestPermission ile izin alınmalı.
 */
export function useFireDesktopNotification(bannerVisible: boolean, enabled: boolean) {
  const wasVisible = useRef(false);

  useEffect(() => {
    if (!enabled) {
      wasVisible.current = bannerVisible;
      return;
    }
    if (typeof Notification === "undefined") {
      wasVisible.current = bannerVisible;
      return;
    }
    if (bannerVisible && !wasVisible.current && Notification.permission === "granted") {
      try {
        new Notification("Akıllı Oda — Yangın uyarısı", {
          body: "Yangın algılandı. Tahliye işlemlerini başlatın.",
          tag: "smartroom-fire",
        });
      } catch {
        /* bazı ortamlar Notification fırlatabilir */
      }
    }
    wasVisible.current = bannerVisible;
  }, [bannerVisible, enabled]);
}

export async function requestFireNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}
