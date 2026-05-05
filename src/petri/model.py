from dataclasses import dataclass


@dataclass
class PetriState:
    room_capacity: int
    room_id: str = "room1"
    occupancy: int = 0
    emergency: bool = False
    last_emergency_reason: str = ""
    last_event_type: str = "idle"
    last_event_source: str = ""
    last_event_confidence: float = 0.0
    updated_at: str = ""

    @property
    def room_empty_tokens(self) -> int:
        return max(self.room_capacity - self.occupancy, 0)

    @property
    def room_occupied_tokens(self) -> int:
        return self.occupancy
