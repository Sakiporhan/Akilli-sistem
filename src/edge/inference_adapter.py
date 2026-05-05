from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

EVENT_TYPES = {"entry", "exit", "fire", "inactivity"}


@dataclass
class InferenceResult:
    event_type: str
    confidence: float
    source: str = "mock_tflite"


class InferenceAdapter(ABC):
    @abstractmethod
    def infer(self, raw_input: Dict[str, object]) -> InferenceResult:
        raise NotImplementedError


def _normalize_event_type(label: str) -> str:
    normalized = label.strip().lower()
    if normalized in EVENT_TYPES:
        return normalized
    return "inactivity"


def build_event_payload(result: InferenceResult, room_id: str, timestamp: str) -> Dict[str, object]:
    return {
        "event_type": _normalize_event_type(result.event_type),
        "timestamp": timestamp,
        "room_id": room_id,
        "source": result.source,
        "confidence": result.confidence,
    }


class MockTFLiteInferenceAdapter(InferenceAdapter):
    def infer(self, raw_input: Dict[str, object]) -> InferenceResult:
        signal = str(raw_input.get("signal", "entry")).lower()
        signal = _normalize_event_type(signal)
        return InferenceResult(event_type=signal, confidence=0.9)


class TFLiteInferenceAdapter(InferenceAdapter):
    """
    Real TFLite adapter skeleton.
    Works with `tflite-runtime` or full `tensorflow` Interpreter.
    """

    def __init__(
        self,
        model_path: str,
        labels: Optional[List[str]] = None,
        source: str = "tflite_model",
        preprocessor: Optional[Callable[[Dict[str, object]], List[float]]] = None,
    ) -> None:
        self.model_path = model_path
        self.labels = labels or ["entry", "exit", "fire", "inactivity"]
        self.source = source
        self.preprocessor = preprocessor or self._default_preprocessor
        self._interpreter = self._create_interpreter(model_path)
        self._interpreter.allocate_tensors()
        self._input_details = self._interpreter.get_input_details()
        self._output_details = self._interpreter.get_output_details()

    def infer(self, raw_input: Dict[str, object]) -> InferenceResult:
        try:
            import numpy as np
        except ImportError as exc:
            raise RuntimeError("numpy is required for TFLite inference") from exc

        features = self.preprocessor(raw_input)
        if not features:
            raise ValueError("Preprocessor returned empty features")

        input_tensor = np.array([features], dtype=np.float32)
        self._interpreter.set_tensor(self._input_details[0]["index"], input_tensor)
        self._interpreter.invoke()
        output = self._interpreter.get_tensor(self._output_details[0]["index"])

        probs = np.array(output[0], dtype=np.float32)
        class_index = int(np.argmax(probs))
        confidence = float(probs[class_index])
        label = self.labels[class_index] if class_index < len(self.labels) else "inactivity"

        return InferenceResult(
            event_type=_normalize_event_type(label),
            confidence=max(0.0, min(confidence, 1.0)),
            source=self.source,
        )

    @staticmethod
    def _create_interpreter(model_path: str):
        try:
            from tflite_runtime.interpreter import Interpreter  # type: ignore
        except ImportError:
            try:
                from tensorflow.lite import Interpreter  # type: ignore
            except ImportError as exc:
                raise RuntimeError(
                    "No TFLite interpreter found. Install `tflite-runtime` or `tensorflow`."
                ) from exc
        return Interpreter(model_path=model_path)

    @staticmethod
    def _default_preprocessor(raw_input: Dict[str, object]) -> List[float]:
        # Default feature order matches docs/edge-model-contract.md
        feature_keys = [
            "temperature_c",
            "humidity_percent",
            "light_lux",
            "motion_score",
            "current_amp",
            "occupancy_estimate",
        ]
        values: List[float] = []
        for key in feature_keys:
            values.append(float(raw_input.get(key, 0.0)))
        return values
