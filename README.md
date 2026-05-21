# Akıllı Oda Doluluk ve Yangın Alarm Simülasyonu

**Bitirme projesi** — Gerçek donanım olmadan oda doluluk takibi, yangın/acil durum senaryoları ve MQTT tabanlı olay akışını simüle eden, ileride Raspberry Pi / edge model ile genişletilebilir bir yazılım hattı.

## Projenin amacı

- Odaya **giriş/çıkış** olaylarıyla doluluk sayısını Petri ağı benzeri bir durum motorunda yönetmek
- **Yangın** ve **hareketsizlik (inactivity)** acil durumlarını tetiklemek, tahliye kuralıyla doluluğu sıfırlamak
- Sıcaklık telemetrisi ile eşik tabanlı yangın alarmı (debounce + histerezis)
- Tüm akışı **MQTT** üzerinden standart bir sözleşmeyle yayınlamak
- **React** veya **Node-RED** dashboard ile canlı izleme
- Donanıma geçiş için hazır **edge / TFLite** adapter sınırı

## Kullanılan teknolojiler

| Katman | Teknoloji |
|--------|-----------|
| Backend | Python 3, Petri durum motoru, Paho MQTT |
| API köprüsü | FastAPI, Uvicorn, WebSocket |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Mesajlaşma | MQTT (Mosquitto) |
| Görsel akış (opsiyonel) | Node-RED |
| Test | pytest |
| Gelecek edge | TFLite (Raspberry Pi) — mock adapter mevcut |

## Sistem mimarisi

Detaylı diyagramlar: **[docs/architecture.md](docs/architecture.md)**

Özet:

```
Simülatör / Dashboard / Node-RED  →  MQTT Broker  →  Controller + Petri Engine
                                              ↓
                                    state / alerts topic'leri
                                              ↓
                              Dashboard Bridge  →  React UI (WebSocket)
```

## Proje yapısı

```
Akilli-sistem/
├── src/
│   ├── config.py              # Ortam değişkenleri ile ayarlar
│   ├── main.py                # --simulate | --controller
│   ├── controller/            # Olay işleme ve alarm üretimi
│   ├── petri/                 # Durum motoru
│   ├── mqtt/                  # Publisher / subscriber
│   ├── dashboard_bridge/      # MQTT ↔ React köprüsü
│   └── edge/                  # TFLite adapter arayüzü
├── scripts/                   # Simülatör ve Windows başlatma betikleri
├── web/smartroom-dashboard/   # React arayüzü
├── configs/                   # Node-RED flow JSON
├── docs/                      # Sözleşmeler ve mimari diyagramlar
└── tests/                     # Birim testler
```

## Kurulum ve çalıştırma

### Gereksinimler

- Python 3.10+
- Node.js 18+ (React dashboard için)
- MQTT broker (ör. [Mosquitto](https://mosquitto.org/download/)) — tam demo için port `1884` önerilir (betikler `scripts/set_demo_env.bat` ile ayarlar)

### Backend kurulumu

```bash
python -m pip install -r requirements.txt
```

### Backend — yerel simülasyon (MQTT olmadan)

```bash
python -m src.main --simulate
```

Konsolda örnek entry/exit/fire/reset akışının state çıktısını görürsünüz.

### Backend — MQTT controller

Broker çalışırken:

```bash
python -m src.main --controller
```

Ortam değişkenleri (isteğe bağlı): `MQTT_BROKER_HOST`, `MQTT_BROKER_PORT`, `ROOM_ID`, `ROOM_CAPACITY`, `FIRE_TEMP_THRESHOLD_C`, vb. — tam liste `src/config.py` içinde.

### Frontend kurulumu ve çalıştırma

```bash
cd web/smartroom-dashboard
npm install
npm run dev
```

Tarayıcı: `http://localhost:5173`  
MQTT köprüsü ile tam stack: `scripts/start_react_dashboard_stack.bat` veya `scripts/start_all_react_bridge_demo.bat`

Köprü ayarı: `web/smartroom-dashboard/.env.example` dosyasını `.env` olarak kopyalayın (`VITE_BRIDGE_ORIGIN`, `VITE_BRIDGE_PORT`).

### Test çalıştırma

```bash
python -m pytest -q
```

### Simülasyon (MQTT ile olay üretimi)

```bash
python -m scripts.event_simulator --scenario default
python -m scripts.event_simulator --scenario fire_drill
python -m scripts.event_simulator --entries 5 --fire
```

Desteklenen senaryolar: `default`, `normal_flow`, `capacity_fill`, `fire_drill`, `fire_live`, `inactivity_watch`, `idle`.

## MQTT ve Node-RED kullanımı

1. MQTT broker'ı başlatın (Windows: `scripts/start_broker.bat` — `Mosquitto/mosquitto.exe` gerekir; bkz. aşağı).
2. Controller: `python -m src.main --controller`
3. Simülatör veya Node-RED'den olay gönderin.
4. Node-RED: `configs/node-red-smartroom-flow.json` dosyasını import edin, broker `127.0.0.1:1884`, Deploy.
5. Node-RED dashboard: `http://127.0.0.1:1880/ui` (flow'a bağlı route).

Topic özeti (`building/room1/...`):

| Topic | Amaç |
|-------|------|
| `entry` / `exit` | Doluluk olayları |
| `emergency` | `fire`, `inactivity` |
| `control` | `reset` |
| `telemetry` | Sıcaklık → otomatik yangın |
| `state` | Controller durum çıktısı |
| `alerts` | Acil durum bildirimleri |

Tam şema: [docs/event-contract.md](docs/event-contract.md)

## Senaryolar

### Oda doluluk (giriş / çıkış)

1. `entry` olayları doluluğu artırır (kapasiteye kadar).
2. `exit` olayları doluluğu azaltır.
3. `occupancy >= PEAK_OCCUPANCY_THRESHOLD` iken state'te `occupancy_load: "peak"` (yoğun saat göstergesi).
4. Acil durum aktifken giriş/çıkış **yok sayılır**.

Akış diyagramı: [docs/architecture.md#oda-giriş--çıkış-doluluk-akışı](docs/architecture.md)

### Yangın alarmı

1. **Doğrudan:** `fire` olayı veya dashboard “Fire” kontrolü.
2. **Sıcaklık:** `telemetry` topic'inde `temperature_c` eşiği aşarsa controller `fire` üretir.
3. Yangında doluluk **0** kabul edilir (tahliye).
4. **Reset:** `control` topic'ine `reset` veya dashboard “Reset Emergency”.
5. Opsiyonel: düşük sıcaklık + `FIRE_TEMP_CLEAR_DEBOUNCE_SEC` ile otomatik reset.

Akış diyagramı: [docs/architecture.md#yangın-alarm-akışı](docs/architecture.md)

## Windows: tek tıkla demo

`scripts/` klasöründe:

| Betik | Açıklama |
|-------|----------|
| `start_all_demo.bat` | Broker + Node-RED + controller + simülatör |
| `start_all_react_bridge_demo.bat` | Broker + köprü + React (önerilen UI) |
| `start_broker.bat` | Sadece MQTT broker |
| `start_dashboard_bridge.bat` | MQTT → WebSocket köprüsü |

Demo MQTT portu: **1884** (`scripts/set_demo_env.bat`).

## Donanıma geçiş

Simülasyon katmanı, gerçek sensör/kamera çıktısı ile aynı MQTT sözleşmesini kullanır.

1. Raspberry Pi üzerinde giriş/çıkış veya sıcaklık verisini toplayın.
2. `src/edge/inference_adapter.py` — `MockTFLiteInferenceAdapter` yerine `TFLiteInferenceAdapter` ve `.tflite` model yolu.
3. `build_event_payload()` ile `entry` / `exit` / `telemetry` JSON üretin.
4. Mevcut topic'lere publish edin; **controller ve dashboard kodu değişmeden** çalışır.

Ayrıntı: [docs/edge-model-contract.md](docs/edge-model-contract.md)

## Petri ağı özeti

Place'ler: `roomEmpty`, `roomOccupied`, `emergency`.  
Geçişler: `entryDetected`, `exitDetected`, `fire`/`inactivity`, `reset`.

Ayrıntılı tablo ve diyagram: [docs/architecture.md#petri-ağı-place-ve-transition](docs/architecture.md)

## Mosquitto notu (GitHub)

Depoda `Mosquitto/` klasörü **versiyon kontrolüne dahil edilmez** (`.gitignore`). Windows betikleri için:

1. [Mosquitto](https://mosquitto.org/download/) indirin.
2. `mosquitto.exe` dosyasını proje kökündeki `Mosquitto/` klasörüne koyun **veya** sistem PATH'ine kurulu broker kullanın ve `scripts/set_demo_env.bat` port/host değerlerini güncelleyin.

Daha önce repoya eklenmiş `Mosquitto/` dosyalarını kaldırmak için (bir kez):

```bash
git rm -r --cached Mosquitto
```

## Sözleşmeler ve dokümantasyon

- [docs/event-contract.md](docs/event-contract.md) — MQTT event/state şeması
- [docs/architecture.md](docs/architecture.md) — Mimari ve akış diyagramları
- [docs/edge-model-contract.md](docs/edge-model-contract.md) — Edge model sınırı

## Sık görülen sorunlar

- **Python bulunamadı:** `python` yerine `py` deneyin (Windows).
- **Dashboard boş:** Köprünün çalıştığını (`py -m src.dashboard_bridge`) ve broker/controller'ın ayakta olduğunu kontrol edin.
- **MQTT veri yok:** Port `1884` (demo) veya `MQTT_BROKER_PORT` ile broker portunun eşleştiğini doğrulayın.
- **React demo modu:** `http://localhost:5173/?demo=1` (MQTT olmadan arayüz denemesi).

## Lisans ve akademik kullanım

Bu depo bitirme projesi kapsamında hazırlanmıştır. Kaynak gösterimi ve kurum yönergelerine uygun kullanım önerilir.
