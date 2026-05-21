from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Optional, Set

import paho.mqtt.client as mqtt
import uvicorn
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from src.config import AppConfig, load_config
from src.dashboard_bridge.history_store import HistoryStore
from src.events import now_iso

logger = logging.getLogger(__name__)


class Hub:
    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop
        self._lock = threading.Lock()
        self._raw_state: Optional[Dict[str, Any]] = None
        self._last_temp_c: float = 0.0
        self.latest_merged: Optional[Dict[str, Any]] = None
        self.clients: Set[WebSocket] = set()
        self.mqtt_client: Optional[mqtt.Client] = None
        self._config: Optional[AppConfig] = None
        self.history_store: Optional[HistoryStore] = None
        self.mqtt_connected: bool = False
        self.last_broadcast_at: Optional[float] = None

    def set_config(self, config: AppConfig) -> None:
        self._config = config

    def _baseline_state(self) -> Dict[str, Any]:
        """Kontrolcü henüz state yayınlamadıysa telemetriyle UI donmasın."""
        cfg = self._config
        cap = int(cfg.room_capacity) if cfg else 10
        rid = cfg.room_id if cfg else "room1"
        peak = int(cfg.peak_occupancy_threshold) if cfg else 5
        on_c = float(cfg.fire_temperature_threshold_c) if cfg else 60.0
        off_c = float(cfg.fire_temperature_reset_threshold_c) if cfg else 55.0
        deb_on = float(cfg.fire_temperature_debounce_sec) if cfg else 0.0
        deb_off = float(cfg.fire_temperature_clear_debounce_sec) if cfg else 0.0
        ts = now_iso()
        return {
            "room_id": rid,
            "room_capacity": cap,
            "occupancy": 0,
            "emergency": False,
            "last_emergency_reason": "",
            "last_event_type": "idle",
            "last_event_source": "",
            "last_event_confidence": 0.0,
            "updated_at": ts,
            "room_empty_tokens": cap,
            "room_occupied_tokens": 0,
            "alert_active": False,
            "fire_temp_on_c": on_c,
            "fire_temp_off_c": off_c,
            "fire_temp_on_debounce_sec": deb_on,
            "fire_temp_off_debounce_sec": deb_off,
            "peak_occupancy_threshold": peak,
            "occupancy_load": "normal",
        }

    def _merge(self) -> Optional[Dict[str, Any]]:
        if self._raw_state is None:
            return None
        merged = dict(self._raw_state)
        merged["temperature_c"] = self._last_temp_c
        return merged

    def on_state_payload(self, payload: Dict[str, Any]) -> None:
        with self._lock:
            self._raw_state = payload
            self.latest_merged = self._merge()
            merged = self.latest_merged
        if merged is not None:
            self._schedule_broadcast(merged)

    def on_telemetry_payload(self, payload: Dict[str, Any]) -> None:
        raw = payload.get("temperature_c")
        if raw is None:
            raw = payload.get("temperature")
        if raw is not None:
            with self._lock:
                self._last_temp_c = float(raw)
                if self._raw_state is None:
                    self._raw_state = self._baseline_state()
                self.latest_merged = self._merge()
                merged = self.latest_merged
        else:
            merged = None
        if merged is not None:
            self._schedule_broadcast(merged)

    def _schedule_broadcast(self, merged: Dict[str, Any]) -> None:
        asyncio.run_coroutine_threadsafe(self.broadcast(merged), self.loop)

    async def broadcast(self, merged: Dict[str, Any]) -> None:
        with self._lock:
            self.last_broadcast_at = time.time()
        store = self.history_store
        if store is not None:
            try:
                await asyncio.to_thread(store.try_append, merged)
            except Exception as exc:
                logger.warning("Olay gunlugu yazilamadi: %s", exc)
        message = {"type": "state", "payload": merged}
        text = json.dumps(message)
        dead: list[WebSocket] = []
        for ws in list(self.clients):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)

    def attach_mqtt(self, client: mqtt.Client) -> None:
        self.mqtt_client = client

    def publish_json(self, topic: str, payload: Dict[str, Any], qos: int = 1) -> None:
        if self.mqtt_client is None:
            raise RuntimeError("MQTT henüz hazır değil")
        msg = self.mqtt_client.publish(topic, json.dumps(payload), qos=qos)
        if qos > 0:
            msg.wait_for_publish(timeout=2)


def _run_mqtt_loop(hub: Hub, config: AppConfig) -> None:
    state_topic = config.topics["state"]
    telemetry_topic = config.topics["telemetry"]

    def on_connect(_client: mqtt.Client, _userdata: object, _flags: Dict[str, int], rc: int) -> None:
        with hub._lock:
            hub.mqtt_connected = rc == 0
        if rc != 0:
            logger.error("MQTT connect rc=%s", rc)
            return
        _client.subscribe([(state_topic, 1), (telemetry_topic, 1)])
        logger.info("MQTT subscribed: %s, %s", state_topic, telemetry_topic)

    def on_disconnect(_client: mqtt.Client, _userdata: object, rc: int) -> None:
        with hub._lock:
            hub.mqtt_connected = False
        logger.warning("MQTT baglantisi koptu rc=%s", rc)

    def on_message(_client: mqtt.Client, _userdata: object, msg: mqtt.MQTTMessage) -> None:
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.warning("MQTT parse error: %s", exc)
            return
        if msg.topic == state_topic:
            hub.on_state_payload(payload)
        elif msg.topic == telemetry_topic:
            hub.on_telemetry_payload(payload)

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    client.reconnect_delay_set(min_delay=1, max_delay=10)
    try:
        client.connect(config.broker_host, config.broker_port, keepalive=30)
    except OSError as exc:
        logger.error("MQTT connect failed: %s", exc)
        return
    hub.attach_mqtt(client)
    client.loop_forever()


def create_app(config: AppConfig) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        loop = asyncio.get_running_loop()
        hub = Hub(loop)
        hub.set_config(config)
        app.state.hub = hub
        t = threading.Thread(target=_run_mqtt_loop, args=(hub, config), daemon=True)
        t.start()
        yield
        if hub.mqtt_client is not None:
            try:
                hub.mqtt_client.disconnect()
            except Exception:
                pass

    app = FastAPI(title="SmartRoom Dashboard Bridge", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:4173",
            "http://localhost:4173",
        ],
        # LAN IP / farklı port (ör. telefondan http://192.168.x.x:5173)
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def _hub() -> Hub:
        return app.state.hub

    @app.get("/api/health")
    def health() -> dict[str, object]:
        h = _hub()
        now = time.time()
        age: Optional[float] = None
        lb = h.last_broadcast_at
        if lb is not None:
            age = round(now - lb, 2)
        return {
            "status": "ok",
            "mqtt_connected": h.mqtt_connected,
            "websocket_clients": len(h.clients),
            "seconds_since_last_broadcast": age,
        }

    @app.get("/api/history")
    def get_history(limit: int = 100) -> dict[str, object]:
        store = _hub().history_store
        if store is None:
            return {"rows": [], "lastSemantic": None}
        lim = max(1, min(limit, 200))
        rows, last_sem = store.fetch_recent(lim)
        return {"rows": rows, "lastSemantic": last_sem}

    @app.delete("/api/history")
    def delete_history() -> dict[str, bool]:
        store = _hub().history_store
        if store is not None:
            store.clear()
        return {"ok": True}

    @app.post("/api/telemetry")
    async def post_telemetry(request: Request) -> dict[str, bool]:
        try:
            data = await request.json()
        except json.JSONDecodeError as exc:
            logger.warning("telemetry JSON decode: %s", exc)
            raise HTTPException(
                status_code=422, detail="Gecerli JSON gonderin"
            ) from exc
        if not isinstance(data, dict):
            raise HTTPException(status_code=422, detail="Govde JSON nesnesi olmali")
        raw_t = data.get("temperature_c")
        if raw_t is None and "temperature" in data:
            raw_t = data.get("temperature")
        if raw_t is None:
            raise HTTPException(status_code=422, detail="temperature_c alani gerekli")
        try:
            temperature_c = float(raw_t)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=422, detail="temperature_c sayisal olmali"
            )
        ts = data.get("timestamp") if isinstance(data.get("timestamp"), str) else None
        ts = ts or now_iso()
        rid_raw = data.get("room_id")
        rid = rid_raw if isinstance(rid_raw, str) and rid_raw else config.room_id
        src_raw = data.get("source")
        source = src_raw if isinstance(src_raw, str) and src_raw else "react_dashboard"
        try:
            confidence = float(data.get("confidence", 1.0))
        except (TypeError, ValueError):
            confidence = 1.0
        payload = {
            "temperature_c": temperature_c,
            "timestamp": ts,
            "room_id": rid,
            "source": source,
            "confidence": confidence,
        }
        try:
            _hub().publish_json(config.topics["telemetry"], payload)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return {"ok": True}

    @app.post("/api/control")
    async def post_control(request: Request) -> dict[str, bool]:
        try:
            data = await request.json()
        except json.JSONDecodeError as exc:
            logger.warning("control JSON decode: %s", exc)
            raise HTTPException(
                status_code=422, detail="Gecerli JSON gonderin"
            ) from exc
        if not isinstance(data, dict):
            raise HTTPException(status_code=422, detail="Govde JSON nesnesi olmali")
        et_raw = data.get("event_type")
        if not isinstance(et_raw, str) or not et_raw.strip():
            raise HTTPException(status_code=422, detail="event_type alani gerekli")
        event_type = et_raw.strip()
        ts = data.get("timestamp") if isinstance(data.get("timestamp"), str) else None
        ts = ts or now_iso()
        rid_raw = data.get("room_id")
        rid = rid_raw if isinstance(rid_raw, str) and rid_raw else config.room_id
        src_raw = data.get("source")
        source = src_raw if isinstance(src_raw, str) and src_raw else "react_dashboard"
        try:
            confidence = float(data.get("confidence", 1.0))
        except (TypeError, ValueError):
            confidence = 1.0
        payload = {
            "event_type": event_type,
            "timestamp": ts,
            "room_id": rid,
            "source": source,
            "confidence": confidence,
        }
        try:
            _hub().publish_json(config.topics["control"], payload)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return {"ok": True}

    @app.post("/api/entry")
    def post_entry() -> dict[str, bool]:
        payload = {
            "event_type": "entry",
            "timestamp": now_iso(),
            "room_id": config.room_id,
            "source": "react_dashboard",
            "confidence": 1.0,
        }
        try:
            _hub().publish_json(config.topics["entry"], payload)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return {"ok": True}

    @app.post("/api/exit")
    def post_exit() -> dict[str, bool]:
        payload = {
            "event_type": "exit",
            "timestamp": now_iso(),
            "room_id": config.room_id,
            "source": "react_dashboard",
            "confidence": 1.0,
        }
        try:
            _hub().publish_json(config.topics["exit"], payload)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        return {"ok": True}

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        hub = _hub()
        await websocket.accept()
        logger.info("WebSocket client baglandi")
        hub.clients.add(websocket)
        if hub.latest_merged is not None:
            await websocket.send_text(
                json.dumps({"type": "state", "payload": hub.latest_merged})
            )
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            hub.clients.discard(websocket)

    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    config = load_config()
    port = config.dashboard_bridge_port
    app = create_app(config)
    # 0.0.0.0: Windows'ta localhost baglantilari icin daha tutarli
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
