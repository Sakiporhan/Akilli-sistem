import argparse
import json
import random
import time
from typing import Dict, List, Optional

import paho.mqtt.client as mqtt
from src.config import load_config
from src.events import now_iso
from src.mqtt.publisher import MqttEventPublisher


SCENARIOS = {
    "default": ["entry", "entry", "exit", "fire", "inactivity", "reset"],
    "normal_flow": ["entry", "entry", "exit"],
    "capacity_fill": ["entry"] * 12,
    "fire_drill": ["entry", "entry", "fire", "reset", "exit"],
    "fire_live": ["entry", "entry", "fire"],
    "idle": [],  # bos: publish_scenario guvenli sicaklik telemetrisi gonderir
    "inactivity_watch": ["entry", "inactivity", "reset"],
}


def build_event(event_type: str, room_id: str) -> Dict[str, object]:
    return {
        "event_type": event_type,
        "timestamp": now_iso(),
        "room_id": room_id,
        "source": "event_simulator",
        "confidence": round(random.uniform(0.8, 1.0), 2),
    }


def fetch_current_occupancy(timeout_seconds: float = 2.0) -> Optional[int]:
    cfg = load_config()
    latest_state: Dict[str, object] = {}

    def on_message(_client: mqtt.Client, _userdata: object, msg: mqtt.MQTTMessage) -> None:
        nonlocal latest_state
        latest_state = json.loads(msg.payload.decode("utf-8"))

    client = mqtt.Client()
    client.on_message = on_message
    client.connect(cfg.broker_host, cfg.broker_port, keepalive=30)
    client.subscribe(cfg.topics["state"], qos=1)
    client.loop_start()
    try:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if latest_state:
                return int(latest_state.get("occupancy", 0))
            time.sleep(0.1)
    finally:
        client.loop_stop()
        client.disconnect()
    return None


def build_custom_steps(
    start_occupancy: int,
    entries: int,
    exits: int,
    target_occupancy: int | None,
    include_fire: bool,
    include_reset: bool,
) -> List[str]:
    steps: List[str] = []
    if target_occupancy is not None:
        if start_occupancy < 0:
            raise ValueError("start_occupancy cannot be negative when using target_occupancy")
        if target_occupancy > start_occupancy:
            entries += target_occupancy - start_occupancy
        elif target_occupancy < start_occupancy:
            exits += start_occupancy - target_occupancy
    steps.extend(["entry"] * max(start_occupancy, 0))
    steps.extend(["entry"] * max(entries, 0))
    steps.extend(["exit"] * max(exits, 0))
    if include_fire:
        steps.append("fire")
    if include_reset:
        steps.append("reset")
    return steps


def publish_steps(steps: List[str], delay_seconds: float) -> None:
    cfg = load_config()
    publisher = MqttEventPublisher(cfg.broker_host, cfg.broker_port)
    publisher.connect()
    topic_map = {
        "entry": cfg.topics["entry"],
        "exit": cfg.topics["exit"],
        "fire": cfg.topics["emergency"],
        "inactivity": cfg.topics["emergency"],
        "reset": cfg.topics["control"],
    }

    try:
        for event_type in steps:
            payload = build_event(event_type, cfg.room_id)
            publisher.publish_json(topic_map[event_type], payload)
            print(f"Published: {payload}")
            time.sleep(delay_seconds)
    finally:
        publisher.disconnect()


def publish_temperature(temperature_c: float, delay_seconds: float, source: str) -> None:
    cfg = load_config()
    publisher = MqttEventPublisher(cfg.broker_host, cfg.broker_port)
    publisher.connect()
    payload: Dict[str, object] = {
        "temperature_c": float(temperature_c),
        "timestamp": now_iso(),
        "room_id": cfg.room_id,
        "source": source,
        "confidence": 1.0,
    }
    try:
        publisher.publish_json(cfg.topics["telemetry"], payload)
        print(f"Published temperature telemetry: {payload}")
        time.sleep(delay_seconds)
    finally:
        publisher.disconnect()


def publish_scenario(name: str, delay_seconds: float) -> None:
    if name not in SCENARIOS:
        supported = ", ".join(sorted(SCENARIOS))
        raise ValueError(f"Unknown scenario: {name}. Supported scenarios: {supported}")
    steps = SCENARIOS[name]
    if not steps:
        publish_temperature(22.0, delay_seconds, "event_simulator_baseline")
        return
    publish_steps(steps, delay_seconds)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publish demo MQTT event scenarios.")
    parser.add_argument(
        "--scenario",
        default="idle",
        choices=sorted(SCENARIOS),
        help="Scenario name to publish (varsayilan: idle = yangin yok, 22°C telemetri).",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.2,
        help="Seconds to wait between published events.",
    )
    parser.add_argument(
        "--start-occupancy",
        type=int,
        default=0,
        help="Initial simulated occupancy to build before custom actions.",
    )
    parser.add_argument(
        "--entries",
        type=int,
        default=0,
        help="How many entry events to publish after the initial occupancy.",
    )
    parser.add_argument(
        "--exits",
        type=int,
        default=0,
        help="How many exit events to publish after entries.",
    )
    parser.add_argument(
        "--target-occupancy",
        type=int,
        default=None,
        help="Build a sequence that moves from start-occupancy to this final occupancy.",
    )
    parser.add_argument(
        "--fire",
        action="store_true",
        help="Append a fire event after custom occupancy events.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Append a reset event after custom occupancy or fire events.",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=None,
        help="Publish a single temperature telemetry value in Celsius.",
    )
    parser.add_argument(
        "--temperature-source",
        default="event_simulator_temp_sensor",
        help="Source label for --temperature payload.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.temperature is not None:
        publish_temperature(args.temperature, args.delay, args.temperature_source)
        return
    if any(
        [
            args.start_occupancy,
            args.entries,
            args.exits,
            args.target_occupancy is not None,
            args.fire,
            args.reset,
        ]
    ):
        start_occupancy = args.start_occupancy
        if args.start_occupancy == 0 and (args.exits or args.target_occupancy is not None):
            current_occupancy = fetch_current_occupancy()
            if current_occupancy is not None:
                if args.target_occupancy is not None:
                    start_occupancy = current_occupancy
                elif args.exits:
                    exits = min(args.exits, current_occupancy)
                    args.exits = exits
        steps = build_custom_steps(
            start_occupancy=start_occupancy,
            entries=args.entries,
            exits=args.exits,
            target_occupancy=args.target_occupancy,
            include_fire=args.fire,
            include_reset=args.reset,
        )
        if not steps:
            raise ValueError("Custom simulation produced no events. Provide entries, exits, fire, or reset.")
        publish_steps(steps, args.delay)
        return
    publish_scenario(args.scenario, args.delay)


if __name__ == "__main__":
    main()
