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
    fire_temperature_threshold_c: float = 60.0
    fire_temperature_reset_threshold_c: float = 55.0
    fire_temperature_debounce_sec: float = 0.0
    fire_temperature_clear_debounce_sec: float = 0.0
    # Doluluk >= bu sayıda "peak" (MQTT state: occupancy_load).
    peak_occupancy_threshold: int = 5
    dashboard_bridge_port: int = 8765
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
                "telemetry": f"{base}/telemetry",
                "state": f"{base}/state",
                "alerts": f"{base}/alerts",
            }


def load_config() -> AppConfig:
    return AppConfig(
        broker_host=_env_str("MQTT_BROKER_HOST", "127.0.0.1"),
        broker_port=int(_env_str("MQTT_BROKER_PORT", "1883")),
        room_id=os.getenv("ROOM_ID", "room1"),
        room_capacity=int(os.getenv("ROOM_CAPACITY", "10")),
        fire_temperature_threshold_c=float(_env_str("FIRE_TEMP_THRESHOLD_C", "60.0")),
        fire_temperature_reset_threshold_c=float(_env_str("FIRE_TEMP_RESET_THRESHOLD_C", "55.0")),
        fire_temperature_debounce_sec=float(_env_str("FIRE_TEMP_DEBOUNCE_SEC", "0.0")),
        fire_temperature_clear_debounce_sec=float(_env_str("FIRE_TEMP_CLEAR_DEBOUNCE_SEC", "0.0")),
        peak_occupancy_threshold=int(_env_str("PEAK_OCCUPANCY_THRESHOLD", "5")),
        dashboard_bridge_port=int(_env_str("DASHBOARD_BRIDGE_PORT", "8765")),
        topic_prefix=os.getenv("TOPIC_PREFIX", "building"),
    )
