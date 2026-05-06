import type { ReactNode } from "react";
import MuiAutocomplete from "@mui/material/Autocomplete";
import MuiTextField from "@mui/material/TextField";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function AutoComplete({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;

  const options = Array.isArray(props.items) ? (props.items as string[]) : [];
  const value = props.value as string | undefined;

  return (
    <MuiAutocomplete
      options={options}
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
