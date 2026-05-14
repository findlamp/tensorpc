import { useLayoutEffect, type ReactNode } from "react";
import MuiAutocomplete from "@mui/material/Autocomplete";
import MuiTextField from "@mui/material/TextField";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";
import {
  resetCmClusterSelection,
  setCmClusterSelection,
  useCmClusterSelection,
} from "../special/cmSelectionState";

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
  const isClusterPicker = props.label === "Clusters";
  const cmSelection = useCmClusterSelection();

  useLayoutEffect(() => {
    if (isClusterPicker) resetCmClusterSelection();
  }, [isClusterPicker, compUid]);

  const boundOptions = clusterOptionsFromDataModel(layout, props);
  const propOptions = Array.isArray(props.options)
    ? (props.options as unknown[])
    : Array.isArray(props.items)
      ? (props.items as unknown[])
      : [];
  const options = propOptions.length > 0 ? propOptions : boundOptions.options;
  const fallbackWorker = currentWorkerOption(props);
  const value = isClusterPicker
    ? (cmSelection.value ?? null)
    : props.value ?? boundOptions.value ?? fallbackWorker;
  const displayOptions =
    options.length > 0 ? options : fallbackWorker ? [fallbackWorker] : [];
  const labelKey = typeof props.labelKey === "string" ? props.labelKey : "label";
  const optionKey = typeof props.optionKey === "string" ? props.optionKey : "id";
  const optionLabel = (option: unknown) => {
    if (typeof option === "string" || typeof option === "number") return String(option);
    if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
      const label = record[labelKey] ?? record.label ?? record.id ?? record.uid ?? record.ip;
      if (label !== undefined && label !== null) return String(label);
    }
    return "";
  };
  const optionValue = (option: unknown) => {
    if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
      return record[optionKey] ?? record.id ?? record[labelKey] ?? record.label;
    }
    return option;
  };

  return (
    <MuiAutocomplete
      options={displayOptions}
      value={value ?? null}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(option, selected) =>
        optionValue(option) === optionValue(selected) || optionLabel(option) === optionLabel(selected)
      }
      size={props.size as "small" | "medium" | undefined}
      disabled={props.disabled === true}
      disableClearable={props.disableClearable === true || props.label === "Clusters"}
      fullWidth={props.fullWidth === true}
      sx={{ ...sx, minWidth: 150 }}
      onChange={(_e, newValue) => {
        if (isClusterPicker) setCmClusterSelection(newValue);
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

function currentWorkerOption(props: Record<string, unknown>) {
  const label = typeof props.label === "string" ? props.label : "";
  if (!label.startsWith("Workers")) return undefined;
  if (Array.isArray(props.options) && props.options.length === 1) {
    return props.options[0];
  }
  return undefined;
}

function clusterOptionsFromDataModel(
  layout: Record<string, unknown>,
  props: Record<string, unknown>,
) {
  if (props.label !== "Clusters") return { options: [] as unknown[], value: undefined };
  for (const node of Object.values(layout)) {
    if (typeof node !== "object" || node === null) continue;
    const nodeProps = (node as { props?: unknown }).props;
    if (typeof nodeProps !== "object" || nodeProps === null) continue;
    const dataObject = (nodeProps as { dataObject?: unknown }).dataObject;
    if (typeof dataObject !== "object" || dataObject === null) continue;
    const record = dataObject as Record<string, unknown>;
    if (!Array.isArray(record.clusters)) continue;
    const current =
      typeof record.cur_cluster === "object" && record.cur_cluster !== null
        ? record.cur_cluster
        : undefined;
    return {
      options: record.clusters,
      value: current,
    };
  }
  return { options: [] as unknown[], value: undefined };
}
