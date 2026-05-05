from typing import Dict, Optional

from src.events import Event, validate_event_payload
from src.petri.engine import PetriEngine


class ControllerService:
    def __init__(self, engine: PetriEngine) -> None:
        self.engine = engine

    def process_payload(self, payload: Dict[str, object]) -> Dict[str, object]:
        event = validate_event_payload(payload)
        return self.process_event(event)

    def process_event(self, event: Event) -> Dict[str, object]:
        return self.engine.apply_event(event)

    def build_alert(self, state: Dict[str, object], room_id: str) -> Optional[Dict[str, object]]:
        if not state.get("emergency"):
            return None
        if state.get("last_event_type") not in {"fire", "inactivity"}:
            return None
        reason = str(state.get("last_emergency_reason", "unknown"))
        return {
            "room_id": room_id,
            "alert_type": "emergency",
            "reason": reason,
            "source": str(state.get("last_event_source", "")),
            "timestamp": str(state.get("updated_at", "")),
        }
