from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict

VALID_EVENT_TYPES = {"entry", "exit", "fire", "inactivity", "reset"}


@dataclass(frozen=True)
class Event:
    event_type: str
    timestamp: str
    room_id: str
    source: str
    confidence: float

    def as_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "timestamp": self.timestamp,
            "room_id": self.room_id,
            "source": self.source,
            "confidence": self.confidence,
        }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_event_payload(payload: Dict[str, Any]) -> Event:
    required = {"event_type", "timestamp", "room_id", "source", "confidence"}
    missing = required.difference(payload.keys())
    if missing:
        raise ValueError(f"Missing required fields: {sorted(missing)}")

    event_type = str(payload["event_type"]).strip().lower()
    if event_type not in VALID_EVENT_TYPES:
        raise ValueError(f"Unsupported event_type: {event_type}")

    confidence = float(payload["confidence"])
    if confidence < 0.0 or confidence > 1.0:
        raise ValueError("confidence must be between 0.0 and 1.0")

    return Event(
        event_type=event_type,
        timestamp=str(payload["timestamp"]),
        room_id=str(payload["room_id"]),
        source=str(payload["source"]),
        confidence=confidence,
    )
