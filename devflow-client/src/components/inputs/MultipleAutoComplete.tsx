import type { ReactNode } from "react";
import MuiAutocomplete from "@mui/material/Autocomplete";
import MuiTextField from "@mui/material/TextField";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";
import {
  cmClusterKey,
  useCmClusterSelection,
} from "../special/cmSelectionState";

export function MultipleAutoComplete({
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

  const boundOptions = gpuOptionsFromDataModel(layout, props, cmSelection);
  const propOptions = Array.isArray(props.options)
    ? (props.options as unknown[])
    : Array.isArray(props.items)
      ? (props.items as unknown[])
      : [];
  const options = propOptions.length > 0 ? propOptions : boundOptions;
  const values = Array.isArray(props.value)
    ? (props.value as unknown[])
    : Array.isArray(props.values)
      ? (props.values as unknown[])
      : [];
  const labelKey = typeof props.labelKey === "string" ? props.labelKey : "label";
  const optionLabel = (option: unknown) => {
    if (typeof option === "string" || typeof option === "number") return String(option);
    if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
      const label = record[labelKey] ?? record.label ?? record.id ?? record.uid;
      if (label !== undefined && label !== null) return String(label);
    }
    return "";
  };
  const optionValue = (option: unknown) => {
    if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
      return record.id ?? record[labelKey] ?? record.label;
    }
    return option;
  };

  return (
    <MuiAutocomplete
      multiple
      options={options}
      value={values}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(option, selected) =>
        optionValue(option) === optionValue(selected) || optionLabel(option) === optionLabel(selected)
      }
      size={props.size as "small" | "medium" | undefined}
      disabled={props.disabled === true}
      fullWidth={props.fullWidth === true}
      sx={{ ...sx, minWidth: 150 }}
      onChange={(_e, newValues) => {
        if (compUid) sendEvent(compUid, 20 /* Change */, newValues);
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

function gpuOptionsFromDataModel(
  layout: Record<string, unknown>,
  props: Record<string, unknown>,
  selection: { key?: string; value?: unknown },
) {
  if (props.label !== "GPU Types") return [] as unknown[];
  if (!selection.key) return [] as unknown[];
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
    if (Array.isArray(current.all_gpu_infos)) return current.all_gpu_infos;
    if (Array.isArray(current.tags)) return current.tags;
  }
  if (typeof selection.value === "object" && selection.value !== null) {
    const current = selection.value as Record<string, unknown>;
    if (Array.isArray(current.all_gpu_infos)) return current.all_gpu_infos;
    if (Array.isArray(current.tags)) return current.tags;
  }
  return [] as unknown[];
}
