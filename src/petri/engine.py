from dataclasses import asdict
from typing import Dict

from src.events import Event
from src.petri.model import PetriState


class PetriEngine:
    def __init__(self, room_capacity: int, room_id: str = "room1") -> None:
        self.state = PetriState(room_capacity=room_capacity, room_id=room_id)

    def apply_event(self, event: Event) -> Dict[str, object]:
        self._record_event(event)
        if event.event_type == "entry":
            self._entry_detected()
        elif event.event_type == "exit":
            self._exit_detected()
        elif event.event_type == "fire":
            self._emergency_detected("fire")
        elif event.event_type == "inactivity":
            self._emergency_detected("inactivity")
        elif event.event_type == "reset":
            self._reset_requested()
        else:
            raise ValueError(f"Unknown event type: {event.event_type}")
        return self.get_state_snapshot()

    def _record_event(self, event: Event) -> None:
        self.state.room_id = event.room_id
        self.state.last_event_type = event.event_type
        self.state.last_event_source = event.source
        self.state.last_event_confidence = event.confidence
        self.state.updated_at = event.timestamp

    def _entry_detected(self) -> None:
        if self.state.emergency:
            return
        if self.state.occupancy < self.state.room_capacity:
            self.state.occupancy += 1

    def _exit_detected(self) -> None:
        if self.state.emergency:
            return
        if self.state.occupancy > 0:
            self.state.occupancy -= 1

    def _emergency_detected(self, reason: str) -> None:
        self.state.emergency = True
        self.state.last_emergency_reason = reason

    def _reset_requested(self) -> None:
        self.state.emergency = False
        self.state.last_emergency_reason = ""

    def clear_emergency(self) -> Dict[str, object]:
        self.state.emergency = False
        self.state.last_emergency_reason = ""
        return self.get_state_snapshot()

    def get_state_snapshot(self) -> Dict[str, object]:
        snapshot = asdict(self.state)
        snapshot["room_empty_tokens"] = self.state.room_empty_tokens
        snapshot["room_occupied_tokens"] = self.state.room_occupied_tokens
        snapshot["alert_active"] = self.state.emergency
        return snapshot
