from src.controller.service import ControllerService
from src.events import Event, now_iso, validate_event_payload
from src.petri.engine import PetriEngine


def test_entry_exit_flow_changes_occupancy() -> None:
    engine = PetriEngine(room_capacity=3, room_id="room1")
    controller = ControllerService(engine)

    controller.process_event(Event("entry", now_iso(), "room1", "test", 1.0))
    controller.process_event(Event("entry", now_iso(), "room1", "test", 1.0))
    state = controller.process_event(Event("exit", now_iso(), "room1", "test", 1.0))

    assert state["occupancy"] == 1
    assert state["room_empty_tokens"] == 2
    assert state["emergency"] is False
    assert state["room_id"] == "room1"
    assert state["last_event_type"] == "exit"
    assert state["last_event_source"] == "test"
    assert state["last_event_confidence"] == 1.0
    assert state["alert_active"] is False


def test_event_validation_rejects_bad_confidence() -> None:
    payload = {
        "event_type": "entry",
        "timestamp": now_iso(),
        "room_id": "room1",
        "source": "test",
        "confidence": 2.5,
    }
    try:
        validate_event_payload(payload)
    except ValueError as exc:
        assert "confidence" in str(exc)
    else:
        raise AssertionError("Expected ValueError for invalid confidence")


def test_event_validation_accepts_reset() -> None:
    payload = {
        "event_type": "reset",
        "timestamp": now_iso(),
        "room_id": "room1",
        "source": "dashboard",
        "confidence": 1.0,
    }

    event = validate_event_payload(payload)
    assert event.event_type == "reset"
