import { useSyncExternalStore } from "react";
import { engineUrl } from "../engine";

/**
 * Which data source answered the most recent request.
 * - "fixtures": no engine configured, mock layer serves contract fixtures
 * - "fallback": an engine is configured but was unreachable, mock layer served fixtures
 * - "engine": the live engine answered
 */
export type DataSource = "fixtures" | "fallback" | "engine";

let current: DataSource = engineUrl() ? "engine" : "fixtures";
const listeners = new Set<() => void>();

export function setDataSource(next: DataSource) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

export const getDataSource = () => current;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useDataSource(): DataSource {
  return useSyncExternalStore(subscribe, getDataSource, () => (engineUrl() ? "engine" : "fixtures"));
}
