# Akıllı Oda — React Dashboard

Gerçek zamanlı **MQTT controller** ile çalışan veya tarayıcı içi **demo** modunda kullanılabilen arayüz.

## Canlı mod (Node-RED / eski demo ile aynı mantık)

1. **MQTT broker** çalışır olsun. Ardından kontrolcüyü **ayrı süreçte** başlatın (yoksa state hiç yayınlanmaz):
   ```bash
   py -m src.main --controller
   ```
2. **Köprüyü** başlatın:
   ```bash
   cd ../..   # repo kökü
   py -m pip install -r requirements.txt
   py -m src.dashboard_bridge
   ```
   Varsayılan: `http://127.0.0.1:8765` — WebSocket `/ws`, REST `/api/*`.
3. Ayrı terminalde frontend:
   ```bash
   cd web/smartroom-dashboard
   npm install
   npm run dev
   ```
4. Tarayıcı: **http://localhost:5173/**  
   `npm run dev` iken istekler varsayılan olarak **aynı origin** üzerinden Vite proxy ile köprüye gider (`/api`, `/ws`). Köprüyü farklı makinede kullanacaksanız `.env` içinde `VITE_BRIDGE_ORIGIN=http://...:8765` tanımlayın.

**Tek tık (Windows):** `scripts\start_all_react_bridge_demo.bat` (broker + controller + MQTT köprüsü + Vite + simülatör).  
Hafif sürüm (sadece köprü + Vite): `scripts\start_react_dashboard_stack.bat`.

## Demo mod (MQTT yok)

- **http://localhost:5173/?demo=1**  
- Eski mock simülasyon: `setInterval` + yerel state.

## Ortam değişkenleri

- Python: `MQTT_BROKER_HOST`, `MQTT_BROKER_PORT`, `ROOM_ID`, eşik env’leri (`FIRE_TEMP_*`) — `src.config.load_config` ile aynı.
- Köprü portu: `DASHBOARD_BRIDGE_PORT` (varsayılan `8765`).
- Kalıcı olay günlüğü (SQLite): `DASHBOARD_HISTORY_DB` (varsayılan `./.data/smartroom_history.db`).
- React: `VITE_ROOM_ID` (varsayılan `room1`).

## API (köprü)

| Metot | Yol | Açıklama |
|--------|-----|----------|
| `POST` | `/api/telemetry` | `temperature_c` → `building/{room}/telemetry` |
| `POST` | `/api/control` | `event_type: reset` → control topic |
| `GET` | `/api/health` | Sağlık: `mqtt_connected`, `websocket_clients`, son yayın gecikmesi |
| `GET` | `/api/history` | Kalıcı olay listesi (`rows`, `lastSemantic`) |
| `DELETE` | `/api/history` | Günlüğü temizle |
| `WS` | `/ws` | Birleştirilmiş `state` + son `temperature_c` JSON |

## Klasör yapısı

- `src/components/` — UI bileşenleri
- `src/pages/DashboardPage.tsx` — demo / canlı seçimi
- `src/hooks/useLiveDashboard.ts` — WebSocket + REST
- `src/hooks/useSmartRoomSimulation.ts` — `?demo=1`
- `src/state/simulation.ts` — sadece demo modu
