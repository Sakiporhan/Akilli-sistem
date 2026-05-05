from src.analysis.petri_checks import TransitionDef, deadlock_risk, detect_transition_conflicts, is_bounded
from src.controller.service import ControllerService
from src.events import Event, now_iso
from src.petri.engine import PetriEngine


def test_fire_event_triggers_emergency_and_blocks_flow() -> None:
    engine = PetriEngine(room_capacity=5, room_id="room1")
    controller = ControllerService(engine)

    controller.process_event(Event("entry", now_iso(), "room1", "test", 1.0))
    state = controller.process_event(Event("fire", now_iso(), "room1", "test", 1.0))
    after_fire = controller.process_event(Event("entry", now_iso(), "room1", "test", 1.0))

    assert state["emergency"] is True
    assert state["last_emergency_reason"] == "fire"
    assert after_fire["occupancy"] == 1
    assert deadlock_risk(after_fire) is True
    assert is_bounded(after_fire) is True


def test_reset_event_clears_emergency() -> None:
    engine = PetriEngine(room_capacity=5, room_id="room1")
    controller = ControllerService(engine)

    controller.process_event(Event("fire", now_iso(), "room1", "test", 1.0))
    reset_state = controller.process_event(Event("reset", now_iso(), "room1", "dashboard", 1.0))

    assert reset_state["emergency"] is False
    assert reset_state["last_emergency_reason"] == ""
    assert reset_state["last_event_type"] == "reset"
    assert reset_state["alert_active"] is False


def test_alert_is_built_only_for_new_emergency_events() -> None:
    engine = PetriEngine(room_capacity=5, room_id="room1")
    controller = ControllerService(engine)

    fire_state = controller.process_event(Event("fire", now_iso(), "room1", "sensor", 0.95))
    reset_state = controller.process_event(Event("reset", now_iso(), "room1", "dashboard", 1.0))

    fire_alert = controller.build_alert(fire_state, "room1")
    reset_alert = controller.build_alert(reset_state, "room1")

    assert fire_alert is not None
    assert fire_alert["reason"] == "fire"
    assert fire_alert["source"] == "sensor"
    assert reset_alert is None


def test_transition_conflict_detection() -> None:
    transitions = [
        TransitionDef(name="entryDetected", input_places={"roomEmpty"}, output_places={"roomOccupied"}),
        TransitionDef(name="reserveEntry", input_places={"roomEmpty"}, output_places={"roomOccupied"}),
        TransitionDef(name="exitDetected", input_places={"roomOccupied"}, output_places={"roomEmpty"}),
    ]

    conflicts = detect_transition_conflicts(transitions)
    conflict_pairs = {(a, b) for a, b, _shared in conflicts}
    assert ("entryDetected", "reserveEntry") in conflict_pairs
