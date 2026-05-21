from datetime import datetime, timezone
from typing import Dict, Optional

from src.events import Event, now_iso, validate_event_payload
from src.petri.engine import PetriEngine


class ControllerService:
    def __init__(
        self,
        engine: PetriEngine,
        fire_temperature_threshold_c: float = 60.0,
        fire_temperature_reset_threshold_c: float = 55.0,
        fire_temperature_debounce_sec: float = 0.0,
        fire_temperature_clear_debounce_sec: float = 0.0,
        peak_occupancy_threshold: int = 5,
    ) -> None:
        self.engine = engine
        self.fire_temperature_threshold_c = fire_temperature_threshold_c
        self.fire_temperature_reset_threshold_c = fire_temperature_reset_threshold_c
        self.fire_temperature_debounce_sec = max(fire_temperature_debounce_sec, 0.0)
        self.fire_temperature_clear_debounce_sec = max(fire_temperature_clear_debounce_sec, 0.0)
        self.peak_occupancy_threshold = max(1, int(peak_occupancy_threshold))
        self._high_temp_started_at: Optional[datetime] = None
        self._low_temp_started_at: Optional[datetime] = None

    def process_payload(self, payload: Dict[str, object]) -> Dict[str, object]:
        if "event_type" in payload:
            event = validate_event_payload(payload)
            return self.process_event(event)

        temperature_event = self._event_from_temperature_payload(payload)
        if temperature_event is None:
            return self._enrich_state_snapshot(self.engine.get_state_snapshot())
        return self.process_event(temperature_event)

    def process_event(self, event: Event) -> Dict[str, object]:
        return self._enrich_state_snapshot(self.engine.apply_event(event))

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

    def _event_from_temperature_payload(self, payload: Dict[str, object]) -> Optional[Event]:
        if "temperature_c" in payload:
            temperature_c = float(payload["temperature_c"])
        elif "temperature" in payload:
            temperature_c = float(payload["temperature"])
        else:
            return None
        timestamp = str(payload.get("timestamp", now_iso()))
        observed_at = self._parse_timestamp(timestamp)
        is_emergency_active = bool(self.engine.state.emergency)

        if not is_emergency_active:
            self._low_temp_started_at = None
            if temperature_c >= self.fire_temperature_threshold_c:
                if self.fire_temperature_debounce_sec == 0.0:
                    self._high_temp_started_at = None
                    return Event(
                        event_type="fire",
                        timestamp=timestamp,
                        room_id=str(payload.get("room_id", self.engine.state.room_id)),
                        source=str(payload.get("source", "temperature_sensor")),
                        confidence=float(payload.get("confidence", 1.0)),
                    )
                if self._high_temp_started_at is None:
                    self._high_temp_started_at = observed_at
                    return None
                high_elapsed = (observed_at - self._high_temp_started_at).total_seconds()
                if high_elapsed < self.fire_temperature_debounce_sec:
                    return None
                self._high_temp_started_at = None
                return Event(
                    event_type="fire",
                    timestamp=timestamp,
                    room_id=str(payload.get("room_id", self.engine.state.room_id)),
                    source=str(payload.get("source", "temperature_sensor")),
                    confidence=float(payload.get("confidence", 1.0)),
                )

            self._high_temp_started_at = None
            return None

        self._high_temp_started_at = None
        if temperature_c <= self.fire_temperature_reset_threshold_c:
            if self.fire_temperature_clear_debounce_sec == 0.0:
                self._low_temp_started_at = None
                return Event(
                    event_type="reset",
                    timestamp=timestamp,
                    room_id=str(payload.get("room_id", self.engine.state.room_id)),
                    source=str(payload.get("source", "temperature_hysteresis")),
                    confidence=float(payload.get("confidence", 1.0)),
                )
            if self._low_temp_started_at is None:
                self._low_temp_started_at = observed_at
                return None
            low_elapsed = (observed_at - self._low_temp_started_at).total_seconds()
            if low_elapsed < self.fire_temperature_clear_debounce_sec:
                return None
            self._low_temp_started_at = None
            return Event(
                event_type="reset",
                timestamp=timestamp,
                room_id=str(payload.get("room_id", self.engine.state.room_id)),
                source=str(payload.get("source", "temperature_hysteresis")),
                confidence=float(payload.get("confidence", 1.0)),
            )

        self._low_temp_started_at = None
        return None

    @staticmethod
    def _parse_timestamp(raw_timestamp: str) -> datetime:
        normalized = raw_timestamp.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(normalized)
        except ValueError:
            return datetime.now(timezone.utc)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    def _enrich_state_snapshot(self, state: Dict[str, object]) -> Dict[str, object]:
        enriched = dict(state)
        enriched["fire_temp_on_c"] = self.fire_temperature_threshold_c
        enriched["fire_temp_off_c"] = self.fire_temperature_reset_threshold_c
        enriched["fire_temp_on_debounce_sec"] = self.fire_temperature_debounce_sec
        enriched["fire_temp_off_debounce_sec"] = self.fire_temperature_clear_debounce_sec
        cap = int(enriched.get("room_capacity", self.engine.state.room_capacity))
        peak = max(1, min(self.peak_occupancy_threshold, cap))
        enriched["peak_occupancy_threshold"] = peak
        occ_raw = enriched.get("occupancy", 0)
        try:
            occ = int(occ_raw)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            occ = 0
        enriched["occupancy_load"] = "peak" if occ >= peak else "normal"
        return enriched
