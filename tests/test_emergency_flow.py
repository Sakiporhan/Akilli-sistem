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
    assert state["occupancy"] == 0
    assert after_fire["occupancy"] == 0
    assert deadlock_risk(after_fire) is False
    assert is_bounded(after_fire) is True


def test_reset_event_clears_emergency() -> None:
    engine = PetriEngine(room_capacity=5, room_id="room1")
    controller = ControllerService(engine)

    controller.process_event(Event("entry", now_iso(), "room1", "test", 1.0))
    controller.process_event(Event("fire", now_iso(), "room1", "test", 1.0))
    reset_state = controller.process_event(Event("reset", now_iso(), "room1", "dashboard", 1.0))

    assert reset_state["emergency"] is False
    assert reset_state["last_emergency_reason"] == ""
    assert reset_state["last_event_type"] == "reset"
    assert reset_state["alert_active"] is False
    assert reset_state["occupancy"] == 0


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


def test_temperature_threshold_triggers_fire_emergency() -> None:
    engine = PetriEngine(room_capacity=5, room_id="room1")
    controller = ControllerService(
        engine,
        fire_temperature_threshold_c=57.0,
        fire_temperature_debounce_sec=0.0,
    )

    state = controller.process_payload(
        {
            "temperature_c": 74.2,
            "timestamp": now_iso(),
            "room_id": "room1",
            "source": "temp_sensor_1",
        }
    )
    alert = controller.build_alert(state, "room1")

    assert state["emergency"] is True
    assert state["last_event_type"] == "fire"
    assert state["last_emergency_reason"] == "fire"
    assert state["last_event_source"] == "temp_sensor_1"
    assert state["occupancy"] == 0
    assert state["fire_temp_on_c"] == 57.0
    assert alert is not None
    assert alert["reason"] == "fire"


def test_temperature_below_threshold_keeps_normal_state() -> None:
    engine = PetriEngine(room_capacity=5, room_id="room1")
    controller = ControllerService(engine, fire_temperature_threshold_c=57.0)

    state = controller.process_payload({"temperature_c": 30.0, "room_id": "room1"})
    alert = controller.build_alert(state, "room1")

    assert state["emergency"] is False
    assert alert is None


def test_temperature_requires_debounce_before_fire() -> None:
    engine = PetriEngine(room_capacity=5, room_id="room1")
    controller = ControllerService(
        engine,
        fire_temperature_threshold_c=57.0,
        fire_temperature_debounce_sec=3.0,
    )

    first = controller.process_payload(
        {"temperature_c": 70.0, "timestamp": "2026-05-05T10:00:00+00:00", "room_id": "room1"}
    )
    second = controller.process_payload(
        {"temperature_c": 70.0, "timestamp": "2026-05-05T10:00:02+00:00", "room_id": "room1"}
    )
    third = controller.process_payload(
        {"temperature_c": 70.0, "timestamp": "2026-05-05T10:00:03+00:00", "room_id": "room1"}
    )

    assert first["emergency"] is False
    assert second["emergency"] is False
    assert third["emergency"] is True
    assert third["last_event_type"] == "fire"


def test_temperature_hysteresis_auto_resets_after_cooldown() -> None:
    engine = PetriEngine(room_capacity=5, room_id="room1")
    controller = ControllerService(
        engine,
        fire_temperature_threshold_c=57.0,
        fire_temperature_reset_threshold_c=52.0,
        fire_temperature_debounce_sec=0.0,
        fire_temperature_clear_debounce_sec=4.0,
    )

    controller.process_payload({"temperature_c": 70.0, "timestamp": "2026-05-05T10:00:00+00:00", "room_id": "room1"})
    keep_emergency = controller.process_payload(
        {"temperature_c": 51.0, "timestamp": "2026-05-05T10:00:03+00:00", "room_id": "room1"}
    )
    reset_state = controller.process_payload(
        {"temperature_c": 51.0, "timestamp": "2026-05-05T10:00:07+00:00", "room_id": "room1"}
    )

    assert keep_emergency["emergency"] is True
    assert reset_state["emergency"] is False
    assert reset_state["last_event_type"] == "reset"


def test_transition_conflict_detection() -> None:
    transitions = [
        TransitionDef(name="entryDetected", input_places={"roomEmpty"}, output_places={"roomOccupied"}),
        TransitionDef(name="reserveEntry", input_places={"roomEmpty"}, output_places={"roomOccupied"}),
        TransitionDef(name="exitDetected", input_places={"roomOccupied"}, output_places={"roomEmpty"}),
    ]

    conflicts = detect_transition_conflicts(transitions)
    conflict_pairs = {(a, b) for a, b, _shared in conflicts}
    assert ("entryDetected", "reserveEntry") in conflict_pairs
