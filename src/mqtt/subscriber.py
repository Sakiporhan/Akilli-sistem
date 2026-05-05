import json
import time
from typing import Callable, Dict, Iterable

import paho.mqtt.client as mqtt


EventHandler = Callable[[str, Dict[str, object]], None]


class MqttEventSubscriber:
    def __init__(
        self,
        host: str,
        port: int,
        topics: Iterable[str],
        on_event: EventHandler,
    ) -> None:
        self.client = mqtt.Client()
        self.host = host
        self.port = port
        self.topics = list(topics)
        self.on_event = on_event
        self.client.reconnect_delay_set(min_delay=1, max_delay=10)
        self.client.on_connect = self._handle_connect
        self.client.on_message = self._handle_message

    def connect(self) -> None:
        last_exc: Exception | None = None
        for _ in range(10):
            try:
                self.client.connect(self.host, self.port, keepalive=30)
                for topic in self.topics:
                    self.client.subscribe(topic, qos=1)
                return
            except OSError as exc:
                last_exc = exc
                time.sleep(1)
        if last_exc is not None:
            raise last_exc

    def loop_forever(self) -> None:
        self.client.loop_forever()

    def disconnect(self) -> None:
        self.client.disconnect()

    def _handle_message(self, _client: mqtt.Client, _userdata: object, msg: mqtt.MQTTMessage) -> None:
        payload = json.loads(msg.payload.decode("utf-8"))
        self.on_event(msg.topic, payload)

    def _handle_connect(self, client: mqtt.Client, _userdata: object, _flags: dict, reason_code: int) -> None:
        if reason_code == 0:
            for topic in self.topics:
                client.subscribe(topic, qos=1)
