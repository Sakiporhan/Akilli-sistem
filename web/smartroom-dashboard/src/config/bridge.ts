/**
 * Köprü (FastAPI). Geliştirmede varsayılan: aynı origin + Vite proxy (/api, /ws).
 * Doğrudan köprü: .env içinde VITE_BRIDGE_ORIGIN=http://127.0.0.1:8765
 */
export function getBridgeHttpOrigin(): string {
  const raw = import.meta.env.VITE_BRIDGE_ORIGIN as string | undefined;
  if (raw && raw.trim()) return raw.trim().replace(/\/$/, "");
  if (import.meta.env.DEV) return "";
  return "http://127.0.0.1:8765";
}

export function getBridgeApiUrl(path: string): string {
  const base = getBridgeHttpOrigin().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

function defaultBridgePort(): string {
  const p = import.meta.env.VITE_BRIDGE_PORT as string | undefined;
  if (p && p.trim()) return p.trim();
  return "8765";
}

export function getBridgeWsUrl(): string {
  const raw = import.meta.env.VITE_BRIDGE_ORIGIN as string | undefined;
  if (raw && raw.trim()) {
    try {
      const u = new URL(raw.trim());
      const wsScheme = u.protocol === "https:" ? "wss:" : "ws:";
      return `${wsScheme}//${u.host}/ws`;
    } catch {
      return `ws://127.0.0.1:${defaultBridgePort()}/ws`;
    }
  }
  /**
   * npm run dev: HTTP /api Vite proxy ile gidebilir; WebSocket proxy sık kopar.
   * Doğrudan köprüye bağlan (CORS köprüde 5173 için tanımlı).
   */
  if (import.meta.env.DEV) {
    return `ws://127.0.0.1:${defaultBridgePort()}/ws`;
  }
  return `ws://127.0.0.1:${defaultBridgePort()}/ws`;
}
