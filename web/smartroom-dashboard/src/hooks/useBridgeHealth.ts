import { useEffect, useState } from "react";
import { getBridgeApiUrl } from "../config/bridge";
import type { BridgeHealth } from "../types";

export function useBridgeHealth(enabled: boolean) {
  const [health, setHealth] = useState<BridgeHealth | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHealth(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(getBridgeApiUrl("/api/health"));
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as BridgeHealth;
        if (!cancelled) setHealth(j);
      } catch {
        if (!cancelled) setHealth(null);
      }
    };
    void tick();
    const id = window.setInterval(tick, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return health;
}
