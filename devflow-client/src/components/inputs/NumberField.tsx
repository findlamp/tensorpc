import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import MuiTextField from "@mui/material/TextField";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";
import {
  cmClusterKey,
  useCmClusterSelection,
} from "../special/cmSelectionState";

function numberProp(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cleanNumericValue(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function NumberField({
  props,
  layout,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;
  const cmSelection = useCmClusterSelection();
  const min = numberProp(props.min, 0);
  const boundMax = numberFieldMaxFromDataModel(layout, props, cmSelection);
  const max = boundMax ?? numberProp(props.max, 100);
  const step = numberProp(props.step, 1);
  const propValue = cleanNumericValue(props.value ?? props.defaultValue, min);
  const [draftValue, setDraftValue] = useState(propValue);
  const value = props.value === undefined ? draftValue : propValue;

  useEffect(() => {
    if (props.value !== undefined) setDraftValue(propValue);
  }, [propValue, props.value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const numeric = raw === "" ? min : Number(raw);
    const next = Number.isFinite(numeric)
      ? Math.max(min, Math.min(max, numeric))
      : min;
    setDraftValue(next);
    if (Number.isFinite(next) && compUid) {
      sendEvent(compUid, 20 /* Change */, next);
    }
  };

  return (
    <MuiTextField
      label={String(props.label ?? "")}
      value={String(value)}
      type="number"
      size={props.size as "small" | "medium" | undefined}
      disabled={props.disabled === true}
      error={props.error === true}
      fullWidth={props.fullWidth !== false}
      sx={sx}
      inputProps={{ min, max, step }}
      onChange={handleChange}
    />
  );
}

function numberFieldMaxFromDataModel(
  layout: Record<string, unknown>,
  props: Record<string, unknown>,
  selection: { key?: string; value?: unknown },
) {
  if (props.label !== "Num GPUs") return undefined;
  if (!selection.key) return undefined;
  for (const node of Object.values(layout)) {
    if (typeof node !== "object" || node === null) continue;
    const nodeProps = (node as { props?: unknown }).props;
    if (typeof nodeProps !== "object" || nodeProps === null) continue;
    const dataObject = (nodeProps as { dataObject?: unknown }).dataObject;
    if (typeof dataObject !== "object" || dataObject === null) continue;
    const record = dataObject as Record<string, unknown>;
    const current =
      typeof record.cur_cluster === "object" && record.cur_cluster !== null
        ? (record.cur_cluster as Record<string, unknown>)
        : typeof selection.value === "object" && selection.value !== null
          ? (selection.value as Record<string, unknown>)
          : undefined;
    if (!current) continue;
    if (cmClusterKey(current) !== selection.key) continue;
    const remaining = current.num_gpu_remaining;
    if (typeof remaining === "number" && Number.isFinite(remaining)) return remaining;
    const total = current.num_gpu;
    if (typeof total === "number" && Number.isFinite(total)) return total;
  }
  if (typeof selection.value === "object" && selection.value !== null) {
    const current = selection.value as Record<string, unknown>;
    const remaining = current.num_gpu_remaining;
    if (typeof remaining === "number" && Number.isFinite(remaining)) return remaining;
    const total = current.num_gpu;
    if (typeof total === "number" && Number.isFinite(total)) return total;
  }
  return undefined;
}
