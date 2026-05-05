# Edge Model Contract

Bu belge, gelecekte bağlanacak model veya donanım katmanının hangi ham veriyi alıp hangi event formatını üretmesi gerektiğini tanımlar.

## Amaç

Donanım entegrasyonunda sadece `SensorOrModel -> EventAdapter` katmanı değişsin; MQTT, controller, Petri mantığı ve dashboard sabit kalsın.

## Beklenen Ham Girdi

`src/edge/inference_adapter.py` içindeki varsayılan preprocessor şu feature anahtarlarını bekler:

- `temperature_c`
- `humidity_percent`
- `light_lux`
- `motion_score`
- `current_amp`
- `occupancy_estimate`

Bu alanlar sayısal olarak sağlanmalıdır. Eksik alanlar geçici olarak `0.0` kabul edilir, ancak gerçek donanım entegrasyonunda tüm alanların açıkça gönderilmesi önerilir.

## Model Çıkışı

Model veya kural tabanlı adapter aşağıdaki event sınıflarından birini üretmelidir:

- `entry`
- `exit`
- `fire`
- `inactivity`

Gerektiğinde operatör veya dashboard tarafından `reset` olayı gönderilebilir.

## Adapter Sözleşmesi

Adapter çıkışı şu alanları taşımalıdır:

```json
{
  "event_type": "entry",
  "confidence": 0.94,
  "source": "edge_model"
}
```

Bu çıktı `build_event_payload(...)` ile aşağıdaki standart MQTT event mesajına çevrilir:

```json
{
  "event_type": "entry",
  "timestamp": "2026-04-21T12:00:00+00:00",
  "room_id": "room1",
  "source": "edge_model",
  "confidence": 0.94
}
```

## Entegrasyon Kuralı

- Donanım katmanı topic isimlerini değiştirmemelidir.
- `room_id` mevcut controller konfigürasyonuyla uyumlu olmalıdır.
- `event_type` sadece dokümante edilmiş değerlerden biri olmalıdır.
- `confidence` her zaman `0.0-1.0` aralığında normalize edilmelidir.
