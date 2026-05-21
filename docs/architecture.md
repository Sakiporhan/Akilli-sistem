# Sistem Mimarisi ve Akış Diyagramları

Bu belge, Akıllı Oda Doluluk ve Yangın Alarm Simülasyonu projesinin mimarisini ve olay akışlarını metin tabanlı diyagramlarla özetler.

## Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Kullanıcı / Operatör                                │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          v                     v                     v
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐
│ React Dashboard │   │  Node-RED UI    │   │  event_simulator        │
│ (Vite :5173)    │   │  (:1880)        │   │  (CLI senaryolar)       │
└────────┬────────┘   └────────┬────────┘   └────────────┬────────────┘
         │ WS/REST             │ MQTT publish            │ MQTT publish
         v                     │                         │
┌─────────────────┐             │                         │
│ Dashboard Bridge│             │                         │
│ (FastAPI :8765) │             │                         │
└────────┬────────┘             │                         │
         │ subscribe/publish    │                         │
         └──────────┬───────────┴─────────────────────────┘
                    v
         ┌──────────────────────┐
         │   MQTT Broker        │
         │ (Mosquitto :1883/84) │
         └──────────┬───────────┘
                    │ building/room1/*
                    v
         ┌──────────────────────┐
         │  Controller Service │
         │  + Petri Engine       │
         │  (py -m src.main)     │
         └──────────┬───────────┘
                    │ state / alerts
                    v
         ┌──────────────────────┐
         │  Abone sistemler      │
         │  (dashboard, log)    │
         └──────────────────────┘

Gelecek donanım katmanı (Raspberry Pi):
  Kamera / sensör → Edge TFLite adapter → MQTT entry|exit|telemetry|emergency
```

### Bileşen rolleri

| Bileşen | Rol |
|---------|-----|
| **event_simulator** | Giriş/çıkış/yangın/sıcaklık olaylarını MQTT topic'lerine yazar |
| **Controller** | Olayları doğrular, Petri motoruna uygular, `state` ve `alerts` yayınlar |
| **Dashboard Bridge** | MQTT ↔ WebSocket/REST köprüsü; React arayüzü için canlı veri |
| **React Dashboard** | Doluluk, sıcaklık, alarm ve geçmiş görselleştirme |
| **Node-RED** | Alternatif görsel akış ve demo dashboard (opsiyonel) |

---

## Yangın Alarm Akışı

```
[Sensör / Simülatör / Dashboard]
        │
        │  fire olayı  VEYA  sıcaklık >= FIRE_TEMP_THRESHOLD_C
        v
   MQTT topic: building/room1/emergency  (veya telemetry → controller)
        │
        v
   ControllerService.process_event()
        │
        v
   PetriEngine._emergency_detected("fire")
        │  • emergency = true
        │  • last_emergency_reason = "fire"
        │  • occupancy = 0  (tahliye kuralı)
        v
   state snapshot + alert (reason=fire)
        │
        ├──► building/room1/state   (QoS 1)
        └──► building/room1/alerts (QoS 0, yeni acil durumda)

[Operatör Reset]
        │
        │  reset olayı (dashboard veya control topic)
        v
   PetriEngine._reset_requested()
        │  • emergency = false
        │  • occupancy = 0
        v
   Normal akışa dönüş; yeni entry/exit kabul edilir

[Sıcaklık histerezisi — opsiyonel]
   Sıcaklık düşük + FIRE_TEMP_CLEAR_DEBOUNCE_SEC → otomatik reset olayı
```

---

## Oda Giriş / Çıkış Doluluk Akışı

```
[Giriş algılandı]
        │
        │  event_type: entry  →  building/room1/entry
        v
   Controller → PetriEngine._entry_detected()
        │
        ├─ emergency aktif?  → EVET: doluluk değişmez (akış bloklu)
        └─ emergency yok ve occupancy < capacity?
              → occupancy += 1
              → room_occupied_tokens artar, room_empty_tokens azalır
        v
   state.occupancy_load = "peak" | "normal"
        (occupancy >= PEAK_OCCUPANCY_THRESHOLD ise "peak")

[Çıkış algılandı]
        │
        │  event_type: exit  →  building/room1/exit
        v
   PetriEngine._exit_detected()
        │
        ├─ emergency aktif?  → doluluk değişmez
        └─ occupancy > 0?  → occupancy -= 1

[Kapasite sınırı]
   occupancy == room_capacity iken yeni entry → doluluk artmaz (sınırlı Petri)
```

---

## Petri Ağı: Place ve Transition

Projede sınırlı (bounded) bir oda modeli kullanılır. Kod `src/petri/engine.py` ve analiz yardımcıları `src/analysis/petri_checks.py` içindedir.

### Places (yerler)

| Place | Anlam | Kod karşılığı |
|-------|--------|----------------|
| **roomEmpty** | Odada boş “slot” sayısı | `room_empty_tokens = capacity - occupancy` |
| **roomOccupied** | Odadaki kişi sayısı | `room_occupied_tokens = occupancy` |
| **emergency** | Acil durum kilidi | `emergency: bool` |

Invariant: `roomEmpty + roomOccupied = room_capacity` (acil durum dışında).

### Transitions (geçişler)

| Transition | Girdi place | Çıktı place | Koşul |
|------------|-------------|-------------|--------|
| **entryDetected** | roomEmpty | roomOccupied | `not emergency` ve `occupancy < capacity` |
| **exitDetected** | roomOccupied | roomEmpty | `not emergency` ve `occupancy > 0` |
| **fire / inactivity** | — | emergency | Acil durum açılır; yangında `occupancy := 0` |
| **reset** | emergency | — | Acil durum kapanır; doluluk sıfırlanır |

### Çatışma analizi

Aynı giriş place'ini paylaşan geçişler çakışma riski taşır (ör. iki farklı giriş geçişi `roomEmpty` üzerinde yarışır). Testlerde `detect_transition_conflicts()` bu yapıyı doğrular.

### Deadlock notu

Yangın sonrası doluluk sıfırlanır; acil durumdayken entry/exit yok sayılır. `deadlock_risk()` basit modelde `emergency && occupancy > 0` durumunu işaretler — yangın kuralında occupancy hemen 0 olduğu için pratikte risk düşüktür.

---

## İlgili belgeler

- MQTT sözleşmesi: [event-contract.md](./event-contract.md)
- Edge / TFLite sınırı: [edge-model-contract.md](./edge-model-contract.md)
