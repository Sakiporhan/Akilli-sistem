import argparse
from typing import Dict, List

from src.config import load_config
from src.controller.service import ControllerService
from src.events import now_iso
from src.mqtt.publisher import MqttEventPublisher
from src.mqtt.subscriber import MqttEventSubscriber
from src.petri.engine import PetriEngine


def _simulate_locally() -> None:
    config = load_config()
    engine = PetriEngine(room_capacity=config.room_capacity, room_id=config.room_id)
    controller = ControllerService(
        engine=engine,
        fire_temperature_threshold_c=config.fire_temperature_threshold_c,
        fire_temperature_reset_threshold_c=config.fire_temperature_reset_threshold_c,
        fire_temperature_debounce_sec=config.fire_temperature_debounce_sec,
        fire_temperature_clear_debounce_sec=config.fire_temperature_clear_debounce_sec,
        peak_occupancy_threshold=config.peak_occupancy_threshold,
    )
    demo_events: List[Dict[str, object]] = [
        {"event_type": "entry", "timestamp": now_iso(), "room_id": config.room_id, "source": "sim", "confidence": 0.99},
        {"event_type": "entry", "timestamp": now_iso(), "room_id": config.room_id, "source": "sim", "confidence": 0.98},
        {"event_type": "exit", "timestamp": now_iso(), "room_id": config.room_id, "source": "sim", "confidence": 0.97},
        {"event_type": "fire", "timestamp": now_iso(), "room_id": config.room_id, "source": "sim", "confidence": 1.0},
        {"event_type": "reset", "timestamp": now_iso(), "room_id": config.room_id, "source": "sim", "confidence": 1.0},
    ]
    for payload in demo_events:
        state = controller.process_payload(payload)
        alert = controller.build_alert(state, config.room_id)
        print("STATE:", state)
        if alert:
            print("ALERT:", alert)


def _run_controller() -> None:
    config = load_config()
    engine = PetriEngine(room_capacity=config.room_capacity, room_id=config.room_id)
    controller = ControllerService(
        engine=engine,
        fire_temperature_threshold_c=config.fire_temperature_threshold_c,
        fire_temperature_reset_threshold_c=config.fire_temperature_reset_threshold_c,
        fire_temperature_debounce_sec=config.fire_temperature_debounce_sec,
        fire_temperature_clear_debounce_sec=config.fire_temperature_clear_debounce_sec,
        peak_occupancy_threshold=config.peak_occupancy_threshold,
    )
    publisher = MqttEventPublisher(config.broker_host, config.broker_port)
    publisher.connect()
    # Köprü / dinleyiciler ilk state'i alsın; aksi halde _raw_state boş kalır.
    try:
        initial = controller.process_payload({})
        publisher.publish_json(config.topics["state"], initial, qos=1)
    except Exception as exc:
        print(f"[controller] ilk state yayini basarisiz: {exc}")

    def on_event(_topic: str, payload: Dict[str, object]) -> None:
        try:
            state = controller.process_payload(payload)
            publisher.publish_json(config.topics["state"], state, qos=1)
            alert = controller.build_alert(state, config.room_id)
            if alert:
                publisher.publish_json(config.topics["alerts"], alert, qos=0)
        except Exception as exc:
            print(f"[controller] event islenemedi: {exc}")

    subscriber = MqttEventSubscriber(
        host=config.broker_host,
        port=config.broker_port,
        topics=[
            config.topics["entry"],
            config.topics["exit"],
            config.topics["emergency"],
            config.topics["control"],
            config.topics["telemetry"],
        ],
        on_event=on_event,
    )
    subscriber.connect()
    try:
        subscriber.loop_forever()
    finally:
        subscriber.disconnect()
        publisher.disconnect()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--simulate", action="store_true", help="Run local simulation without MQTT.")
    parser.add_argument("--controller", action="store_true", help="Run MQTT controller loop.")
    args = parser.parse_args()

    if args.simulate:
        _simulate_locally()
        return
    if args.controller:
        _run_controller()
        return
    parser.print_help()


if __name__ == "__main__":
    main()
