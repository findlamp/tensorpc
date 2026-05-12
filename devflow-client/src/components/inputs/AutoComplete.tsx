import type { ReactNode } from "react";
import MuiAutocomplete from "@mui/material/Autocomplete";
import MuiTextField from "@mui/material/TextField";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function AutoComplete({
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

  const options = Array.isArray(props.options)
    ? (props.options as string[])
    : Array.isArray(props.items)
      ? (props.items as string[])
      : [];
  const fallbackWorker = currentWorkerIp(layout, props);
  const value = (props.value as string | undefined) ?? fallbackWorker;
  const displayOptions =
    options.length > 0 ? options : fallbackWorker ? [fallbackWorker] : [];

  return (
    <MuiAutocomplete
      options={displayOptions}
      value={value ?? null}
      size={props.size as "small" | "medium" | undefined}
      disabled={props.disabled === true}
      fullWidth={props.fullWidth === true}
      sx={{ ...sx, minWidth: 150 }}
      onChange={(_e, newValue) => {
        if (compUid) sendEvent(compUid, 20 /* Change */, newValue);
      }}
      renderInput={(params) => (
        <MuiTextField
          {...params}
          label={String(props.label ?? "")}
          variant="outlined"
          size={props.size as "small" | "medium" | undefined}
        />
      )}
    />
  );
}

function currentWorkerIp(
  layout: Record<string, unknown>,
  props: Record<string, unknown>,
) {
  if (props.label !== "Workers") return undefined;
  for (const node of Object.values(layout)) {
    if (typeof node !== "object" || node === null) continue;
    const nodeProps = (node as { props?: unknown }).props;
    if (typeof nodeProps !== "object" || nodeProps === null) continue;
    const dataObject = (nodeProps as { dataObject?: unknown }).dataObject;
    if (typeof dataObject !== "object" || dataObject === null) continue;
    const states = (dataObject as { client_states?: unknown }).client_states;
    if (!Array.isArray(states) || states.length === 0) continue;
    const selected = (dataObject as { selected_client_state?: unknown })
      .selected_client_state;
    const state =
      typeof selected === "object" && selected !== null ? selected : states[0];
    if (typeof state !== "object" || state === null) continue;
    const ip = (state as { ip?: unknown }).ip;
    if (typeof ip === "string" && ip.length > 0) return ip;
    const label = (state as { label?: unknown }).label;
    if (typeof label === "string" && label.length > 0) return label;
  }
  return undefined;
}
