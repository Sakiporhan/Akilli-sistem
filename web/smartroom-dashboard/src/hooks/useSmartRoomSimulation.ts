import { useCallback, useEffect, useReducer } from "react";
import {
  adjustTemperature,
  createInitialState,
  resetSimulation,
  stepOccupancy,
  tickSimulation,
  type SimState,
} from "../state/simulation";

type Action =
  | { type: "tick" }
  | { type: "adjust"; delta: number }
  | { type: "reset" }
  | { type: "occ"; delta: 1 | -1 }
  | { type: "clear_history" };

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case "tick":
      return tickSimulation(state);
    case "adjust":
      return adjustTemperature(state, action.delta);
    case "reset":
      return resetSimulation();
    case "occ":
      return stepOccupancy(state, action.delta);
    case "clear_history":
      return { ...state, history: [] };
    default:
      return state;
  }
}

export function useSmartRoomSimulation(enabled: boolean, intervalMs = 2800) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  const increaseTemp = useCallback(() => dispatch({ type: "adjust", delta: 5 }), []);
  const decreaseTemp = useCallback(() => dispatch({ type: "adjust", delta: -5 }), []);
  const resetEmergency = useCallback(() => dispatch({ type: "reset" }), []);
  const addPerson = useCallback(() => dispatch({ type: "occ", delta: 1 }), []);
  const removePerson = useCallback(() => dispatch({ type: "occ", delta: -1 }), []);
  const clearHistory = useCallback(() => dispatch({ type: "clear_history" }), []);

  return {
    state,
    increaseTemp,
    decreaseTemp,
    resetEmergency,
    addPerson,
    removePerson,
    clearHistory,
  };
}
