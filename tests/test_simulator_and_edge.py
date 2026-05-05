from scripts.event_simulator import SCENARIOS, build_event
from src.edge.inference_adapter import InferenceResult, build_event_payload
from src.events import now_iso


def test_simulator_default_scenario_includes_reset() -> None:
    assert SCENARIOS["default"][-1] == "reset"
    assert "fire_drill" in SCENARIOS


def test_build_event_payload_matches_mqtt_contract() -> None:
    result = InferenceResult(event_type="entry", confidence=0.91, source="edge_model")

    payload = build_event_payload(result, room_id="room1", timestamp=now_iso())

    assert payload["event_type"] == "entry"
    assert payload["room_id"] == "room1"
    assert payload["source"] == "edge_model"
    assert payload["confidence"] == 0.91


def test_simulator_build_event_uses_standard_fields() -> None:
    payload = build_event("fire", "room1")

    assert payload["event_type"] == "fire"
    assert payload["room_id"] == "room1"
    assert payload["source"] == "event_simulator"
    assert 0.8 <= float(payload["confidence"]) <= 1.0
