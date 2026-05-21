import json
import time
from typing import Dict

import paho.mqtt.client as mqtt


class MqttEventPublisher:
    def __init__(self, host: str, port: int) -> None:
        self.client = mqtt.Client()
        self.host = host
        self.port = port
        self.client.reconnect_delay_set(min_delay=1, max_delay=10)

    def connect(self) -> None:
        last_exc: Exception | None = None
        for _ in range(10):
            try:
                self.client.connect(self.host, self.port, keepalive=30)
                # Ağ döngüsü olmadan publish() brokere iletilmez (ayrı istemci = ayrı döngü).
                self.client.loop_start()
                return
            except OSError as exc:
                last_exc = exc
                time.sleep(1)
        if last_exc is not None:
            raise last_exc

    def publish_json(self, topic: str, payload: Dict[str, object], qos: int = 0) -> None:
        message = self.client.publish(topic, json.dumps(payload), qos=qos)
        if qos > 0:
            message.wait_for_publish(timeout=1)
        if message.rc != mqtt.MQTT_ERR_SUCCESS:
            raise RuntimeError(f"MQTT publish failed rc={message.rc} topic={topic}")

    def disconnect(self) -> None:
        try:
            self.client.loop_stop()
        except Exception:
            pass
        try:
            self.client.disconnect()
        except Exception:
            pass
