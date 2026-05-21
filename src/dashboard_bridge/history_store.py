from __future__ import annotations

import json
import math
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

_LABEL_MAP = {
    "fire": "Sıcaklık Eşiği Aşıldı",
    "reset": "Acil Durum Sıfırlandı",
    "exit": "Kişi Çıkışı",
    "entry": "Kişi Girişi",
    "idle": "Beklemede",
    "inactivity": "Hareketsizlik",
}

_uid_n = 0


def _uid() -> str:
    global _uid_n
    _uid_n += 1
    return f"h-{int(time.time() * 1000)}-{_uid_n}"


def semantic_key(merged: Dict[str, Any]) -> str:
    et = str(merged.get("last_event_type") or "idle").strip().lower()
    raw_occ = merged.get("occupancy")
    occ = 0
    if raw_occ is not None:
        try:
            occ = max(0, int(float(raw_occ)))
        except (TypeError, ValueError):
            occ = 0
    e = merged.get("emergency")
    emg = e is True or e == 1 or str(e).lower() == "true"
    ts = str(merged.get("updated_at") or "")
    return f"{et}|{occ}|{1 if emg else 0}|{ts}"


def _recorded_at_ms(merged: Dict[str, Any]) -> int:
    raw = merged.get("updated_at")
    if raw:
        try:
            s = str(raw).replace("Z", "+00:00")
            dt = datetime.fromisoformat(s)
            return int(dt.timestamp() * 1000)
        except ValueError:
            pass
    return int(time.time() * 1000)


def _format_temp(c: Any) -> Optional[float]:
    if c is None:
        return None
    try:
        v = float(c)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v):
        return None
    return round(v, 1)


def build_history_row(merged: Dict[str, Any], sk: str) -> Dict[str, Any]:
    event_type = str(merged.get("last_event_type") or "idle").strip().lower()
    occ = 0
    if merged.get("occupancy") is not None:
        try:
            occ = max(0, int(float(merged["occupancy"])))
        except (TypeError, ValueError):
            occ = 0
    e = merged.get("emergency")
    emg = e is True or e == 1 or str(e).lower() == "true"

    ev_label = _LABEL_MAP.get(event_type, event_type)
    if event_type == "exit" and occ == 0:
        ev_label = "Oda Terk Edildi"
    if event_type == "fire":
        ev_label = "Sıcaklık Eşiği Aşıldı"
    if event_type == "reset":
        src = str(merged.get("last_event_source") or "").lower()
        if "temperature" in src or "hysteresis" in src:
            ev_label = "Sıcaklık Normalleşti"

    ms = _recorded_at_ms(merged)
    try:
        # Windows’ta tzdata yokken ZoneInfo patlar; yerel saat yeterli.
        dt = datetime.fromtimestamp(ms / 1000.0)
        time_tr = dt.strftime("%H:%M:%S")
    except (OSError, OverflowError):
        time_tr = "-"

    reason_raw = str(merged.get("last_emergency_reason") or "").strip()
    temp = _format_temp(merged.get("temperature_c"))

    row: Dict[str, Any] = {
        "id": _uid(),
        "time": time_tr,
        "event": ev_label,
        "occupancy": occ,
        "emergency": emg,
        "recordedAtMs": ms,
        "eventKind": event_type,
        "semanticKey": sk,
    }
    src = str(merged.get("last_event_source") or "").strip()
    if src:
        row["source"] = src
    if temp is not None:
        row["temperatureC"] = temp
    if reason_raw:
        row["emergencyReason"] = reason_raw
    return row


class HistoryStore:
    def __init__(self, db_path: str) -> None:
        self._path = db_path
        self._lock = threading.Lock()
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        with self._lock:
            conn = sqlite3.connect(self._path)
            try:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        semantic_key TEXT NOT NULL,
                        row_json TEXT NOT NULL
                    )
                    """
                )
                conn.commit()
            finally:
                conn.close()

    def try_append(self, merged: Dict[str, Any]) -> None:
        sk = semantic_key(merged)
        row = build_history_row(merged, sk)
        blob = json.dumps(row, ensure_ascii=False)
        with self._lock:
            conn = sqlite3.connect(self._path)
            try:
                cur = conn.execute(
                    "SELECT semantic_key FROM events ORDER BY id DESC LIMIT 1"
                )
                prev = cur.fetchone()
                if prev and prev[0] == sk:
                    return
                conn.execute(
                    "INSERT INTO events (semantic_key, row_json) VALUES (?, ?)",
                    (sk, blob),
                )
                cur = conn.execute("SELECT COUNT(*) FROM events")
                n = int(cur.fetchone()[0])
                if n > 500:
                    excess = n - 500
                    conn.execute(
                        """
                        DELETE FROM events WHERE id IN (
                            SELECT id FROM events ORDER BY id ASC LIMIT ?
                        )
                        """,
                        (excess,),
                    )
                conn.commit()
            finally:
                conn.close()

    def fetch_recent(self, limit: int = 100) -> tuple[List[Dict[str, Any]], Optional[str]]:
        with self._lock:
            conn = sqlite3.connect(self._path)
            try:
                cur = conn.execute(
                    """
                    SELECT row_json FROM events
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
                raw_rows = [json.loads(r[0]) for r in cur.fetchall()]
                raw_rows.reverse()
                last_sem: Optional[str] = None
                cur2 = conn.execute(
                    "SELECT semantic_key FROM events ORDER BY id DESC LIMIT 1"
                )
                r2 = cur2.fetchone()
                if r2:
                    last_sem = str(r2[0])
                return raw_rows, last_sem
            finally:
                conn.close()

    def clear(self) -> None:
        with self._lock:
            conn = sqlite3.connect(self._path)
            try:
                conn.execute("DELETE FROM events")
                conn.commit()
            finally:
                conn.close()
