from dataclasses import dataclass, field
from typing import Dict
import os


def _env_str(key: str, default: str) -> str:
    raw = os.getenv(key)
    if raw is None:
        return default
    stripped = raw.strip()
    return stripped if stripped else default


@dataclass
class AppConfig:
    broker_host: str = "127.0.0.1"
    broker_port: int = 1883
    room_id: str = "room1"
    room_capacity: int = 10
    topic_prefix: str = "building"
    topics: Dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        base = f"{self.topic_prefix}/{self.room_id}"
        if not self.topics:
            self.topics = {
                "entry": f"{base}/entry",
                "exit": f"{base}/exit",
                "emergency": f"{base}/emergency",
                "control": f"{base}/control",
                "state": f"{base}/state",
                "alerts": f"{base}/alerts",
            }


def load_config() -> AppConfig:
    return AppConfig(
        broker_host=_env_str("MQTT_BROKER_HOST", "127.0.0.1"),
        broker_port=int(_env_str("MQTT_BROKER_PORT", "1883")),
        room_id=os.getenv("ROOM_ID", "room1"),
        room_capacity=int(os.getenv("ROOM_CAPACITY", "10")),
        topic_prefix=os.getenv("TOPIC_PREFIX", "building"),
    )
