import type { ReactNode } from "react";
import MuiAutocomplete from "@mui/material/Autocomplete";
import MuiTextField from "@mui/material/TextField";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function MultipleAutoComplete({
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
  const values = Array.isArray(props.values) ? (props.values as string[]) : [];

  return (
    <MuiAutocomplete
      multiple
      options={options}
      value={values}
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
