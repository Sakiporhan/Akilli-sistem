from dataclasses import dataclass
from typing import Dict, List, Set, Tuple


@dataclass(frozen=True)
class TransitionDef:
    name: str
    input_places: Set[str]
    output_places: Set[str]


def detect_transition_conflicts(transitions: List[TransitionDef]) -> List[Tuple[str, str, Set[str]]]:
    conflicts: List[Tuple[str, str, Set[str]]] = []
    for i in range(len(transitions)):
        for j in range(i + 1, len(transitions)):
            shared_inputs = transitions[i].input_places.intersection(transitions[j].input_places)
            if shared_inputs:
                conflicts.append((transitions[i].name, transitions[j].name, shared_inputs))
    return conflicts


def deadlock_risk(state: Dict[str, object]) -> bool:
    emergency = bool(state.get("emergency", False))
    occupancy = int(state.get("occupancy", 0))
    room_capacity = int(state.get("room_capacity", 0))
    # In this simplified model, deadlock risk appears only if emergency blocks flow.
    return emergency and occupancy > 0 and room_capacity > 0


def is_bounded(state: Dict[str, object]) -> bool:
    occupancy = int(state.get("occupancy", 0))
    room_capacity = int(state.get("room_capacity", 0))
    return 0 <= occupancy <= room_capacity
