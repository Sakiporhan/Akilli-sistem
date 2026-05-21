# MQTT Event Contract

Bu belge, simulator, controller, dashboard ve gelecekteki donanım yayımcısının uyması gereken tek veri sözleşmesidir.

## Topic Yapısı

Varsayılan topic prefix'i `building`, varsayılan oda kimliği `room1`'dir.

- `building/room1/entry`: giriş olayları
- `building/room1/exit`: çıkış olayları
- `building/room1/emergency`: `fire` ve `inactivity` olayları
- `building/room1/control`: `reset` gibi kontrol olayları
- `building/room1/telemetry`: sıcaklık gibi sensör telemetrisi
- `building/room1/state`: controller tarafından yayınlanan standart oda durumu
- `building/room1/alerts`: dashboard veya başka sistemlerin dinlediği alarmlar

## Gelen Event Şeması

Tüm giriş topic'lerinde aynı JSON şeması kullanılır.

```json
{
  "event_type": "entry",
  "timestamp": "2026-04-21T12:00:00+00:00",
  "room_id": "room1",
  "source": "camera_1",
  "confidence": 0.93
}
```

## Zorunlu Alanlar

- `event_type`: `entry|exit|fire|inactivity|reset`
- `timestamp`: ISO-8601 zaman damgası
- `room_id`: oda kimliği
- `source`: olay kaynağı (`camera`, `edge_model`, `event_simulator` gibi)
- `confidence`: `0.0` ile `1.0` aralığında güven skoru

## Topic Bazlı Event Kullanımı

- `entry` topic'i sadece `event_type: "entry"` kabul eder.
- `exit` topic'i sadece `event_type: "exit"` kabul eder.
- `emergency` topic'i `fire` veya `inactivity` kabul eder.
- `control` topic'i şu an sadece `reset` kabul eder.
- `telemetry` topic'i sıcaklık payload'ı kabul eder ve eşik aşımında otomatik `fire` üretir.

`telemetry` örnek payload:

```json
{
  "temperature_c": 74.2,
  "timestamp": "2026-05-05T11:00:00+00:00",
  "room_id": "room1",
  "source": "temp_sensor_1",
  "confidence": 1.0
}
```

## Doğrulama Kuralları

- Eksik alan kabul edilmez.
- Tanımsız `event_type` kabul edilmez.
- `confidence` aralık dışında olamaz.
- Donanım veya model katmanı `room_id` ve `source` alanlarını boş bırakamaz.
- `FIRE_TEMP_THRESHOLD_C` (varsayılan `60.0`) ve üstü sıcaklıkta controller `fire` event'i tetikler (`FIRE_TEMP_DEBOUNCE_SEC` varsayılan `0.0`).
- `FIRE_TEMP_RESET_THRESHOLD_C` (varsayılan `55.0`) ve altına düşen sıcaklıkta controller otomatik `reset` event'i üretir (`FIRE_TEMP_CLEAR_DEBOUNCE_SEC` varsayılan `0.0`).
- Bu iki farklı eşik hysteresis davranışı sağlar ve sınır değer çevresindeki titreşimde alarm dalgalanmasını azaltır.

## Controller `state` Çıkışı

Controller her event'ten sonra aşağıdaki yapıyı yayınlar:

```json
{
  "room_capacity": 10,
  "room_id": "room1",
  "occupancy": 2,
  "emergency": false,
  "last_emergency_reason": "",
  "last_event_type": "exit",
  "last_event_source": "event_simulator",
  "last_event_confidence": 0.88,
  "updated_at": "2026-04-21T12:00:10+00:00",
  "room_empty_tokens": 8,
  "room_occupied_tokens": 2,
  "alert_active": false
}
```

Alan anlamları:

- `occupancy`: odadaki kişi sayısı
- `emergency`: acil durum aktif mi
- `last_emergency_reason`: son acil durum nedeni (`fire` veya `inactivity`)
- `last_event_type`: state'i en son güncelleyen olay
- `last_event_source`: son olayı üreten kaynak
- `updated_at`: son state güncelleme zamanı
- `room_empty_tokens`: boş kapasite
- `room_occupied_tokens`: dolu token sayısı
- `alert_active`: dashboard için doğrudan kullanılabilir acil durum bayrağı

## Controller `alerts` Çıkışı

`alerts` topic'i sadece yeni bir `fire` veya `inactivity` olayı emergency durumunu tetiklediğinde yayınlanır.

```json
{
  "room_id": "room1",
  "alert_type": "emergency",
  "reason": "fire",
  "source": "event_simulator",
  "timestamp": "2026-04-21T12:00:11+00:00"
}
```

## Donanım Entegrasyonu Notu

Gelecekte Raspberry Pi, ESP32 veya kamera modeli bağlandığında değişmesi gereken tek parça event üreten katmandır. Donanım tarafı bu belgeye uygun MQTT mesajları yayınladığı sürece controller, Petri motoru ve dashboard değiştirilmeden çalışır.
