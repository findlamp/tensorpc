import { useSyncExternalStore } from "react";

type SelectionState = {
  key?: string;
  value?: unknown;
};

let state: SelectionState = {};
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function cmClusterKey(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const key =
    record.id ??
    record.uid ??
    record.label ??
    (typeof record.name === "string" && typeof record.provider === "string"
      ? `${record.name}@${record.provider}`
      : undefined);
  return key === undefined || key === null ? undefined : String(key);
}

export function resetCmClusterSelection() {
  state = {};
  emit();
}

export function setCmClusterSelection(value: unknown) {
  state = { key: cmClusterKey(value), value };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function useCmClusterSelection() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
