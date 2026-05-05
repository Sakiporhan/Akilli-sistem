# Donanımsız Petri-Edge MVP

Bu proje, gerçek donanım olmadan oda doluluk ve acil durum akışlarını olay-temelli şekilde simüle etmek ve daha sonra donanıma bağlanabilecek sabit bir yazılım hattı kurmak için hazırlanmıştır.

## Özellikler

- MQTT olay sözleşmesi (`entry`, `exit`, `fire`, `inactivity`)
- Petri ağı benzeri durum motoru
- Controller servisi ile olay -> durum -> alarm akışı
- Deadlock/çatışma için temel analiz yardımcıları
- Raspberry Pi için hazır mock TFLite adapter arayüzü
- Temel test senaryoları

## Kurulum

```bash
py -m venv .venv
.venv\Scripts\activate
py -m pip install -r requirements.txt
```

## Test Çalıştırma

```bash
pytest -q
```

## Simülasyon Çalıştırma (MQTT olmadan)

```bash
py -m src.main --simulate
```

## MQTT ile Çalıştırma

Önce bir broker çalıştırın (ör. Mosquitto). Sonra:

```bash
py -m src.main --controller
py -m scripts.event_simulator --scenario default
```

## Windows: Tek tıkla canlandırma (CMD yazmadan)

`scripts` klasöründe:

- `start_all_demo.bat` — broker + Node-RED + controller + simulator'u ayrı pencerelerde açar (port `1884`).
- `start_broker.bat` / `start_controller.bat` / `start_simulator.bat` — tek tek çalıştırmak için.
- `start_node_red.bat` — Node-RED arayüzünü başlatır.

## Demo Akışı

1. `scripts\start_all_demo.bat` çalıştırın.
2. Node-RED editörü açılınca `configs/node-red-smartroom-flow.json` dosyasını import edin.
3. MQTT broker ayarının `127.0.0.1:1884` olduğundan emin olun.
4. Deploy edin.
5. Dashboard'u `http://127.0.0.1:1880/dashboard/smartroom` adresinden açın.
6. Gerekirse farklı bir senaryo için yeni bir terminalde aşağıdakini çalıştırın:

```bash
py -m scripts.event_simulator --scenario fire_drill
```

Sabit senaryo yerine kişi sayısını siz vermek isterseniz parametreli kullanım da vardır:

```bash
py -m scripts.event_simulator --entries 5
py -m scripts.event_simulator --exits 4
py -m scripts.event_simulator --start-occupancy 2 --target-occupancy 7
py -m scripts.event_simulator --start-occupancy 7 --target-occupancy 3
py -m scripts.event_simulator --entries 2 --fire
py -m scripts.event_simulator --entries 2 --fire --reset
```

Bu kullanımda:

- `--entries 5` mevcut duruma 5 giriş ekler
- `--exits 4` mevcut durumdan 4 çıkış gönderir
- `--start-occupancy 2 --target-occupancy 7` sıfırdan 2 kişiden başlayıp 7 kişilik akış üretir
- `--start-occupancy 7 --target-occupancy 3` sıfırdan 7 kişiden başlayıp 3 kişiye düşen akış üretir
- `--fire` yangın olayını sona ekler
- `--reset` acil durum temizleme olayını sona ekler

Desteklenen senaryolar:

- `default`
- `normal_flow`
- `capacity_fill`
- `fire_drill`
- `fire_live`
- `inactivity_watch`

Dashboard üzerinde `Reset Emergency` butonu `building/room1/control` topic'ine `reset` olayı gönderir.

Yeni dashboard özellikleri:

- `Quick Controls`: `+5 Entry`, `-4 Exit`, `Fire`, `Reset Emergency`
- `Occupancy Trend`: kişi sayısını zaman ekseninde çizgi grafikle izleme
- `Event History`: son durum/event akışını zaman damgası ile listeleme

## Sık Görülen Hatalar

- `Python bulunamadı`: Komutları `python` yerine `py` ile çalıştırın.
- Dashboard boşsa: Node-RED flow'unun import edildiğini ve deploy edildiğini kontrol edin.
- Veri gelmiyorsa: MQTT broker portunun `1884` olduğundan emin olun.
- Alert temizlenmiyorsa: Dashboard'daki `Reset Emergency` butonunu kullanın veya `control` topic'ine `reset` mesajı gönderin.

## Sözleşmeler

- MQTT event ve state sözleşmesi: `docs/event-contract.md`
- Edge model ve donanım adapter sınırı: `docs/edge-model-contract.md`

## TFLite Geçiş Notu (Raspberry Pi)

`src/edge/inference_adapter.py` içinde:

- `MockTFLiteInferenceAdapter`: mevcut demo/mock akışı
- `TFLiteInferenceAdapter`: gerçek `.tflite` modeli için hazır iskelet

Gerçek modele geçerken:

1. `tflite-runtime` (ve `numpy`) kur
2. Model dosya yolunu `TFLiteInferenceAdapter(model_path=...)` ile ver
3. Gerekirse `preprocessor` ile feature dönüştürmesini özelleştir
4. `build_event_payload(...)` ile model sonucunu MQTT event formatına çevir
5. `docs/edge-model-contract.md` içindeki feature ve output sözleşmesine uy

## Proje Yapısı

- `src/config.py`: Uygulama ayarları
- `src/events.py`: Olay modeli ve doğrulama
- `src/petri/`: Petri modeli ve motoru
- `src/controller/service.py`: Olay işleme akışı
- `src/mqtt/`: Publisher/subscriber katmanı
- `src/analysis/petri_checks.py`: Deadlock/çatışma analiz yardımcıları
- `src/edge/inference_adapter.py`: TFLite adapter arayüzü
- `tests/`: Birim testler
