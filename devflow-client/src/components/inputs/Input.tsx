import type { ReactNode } from "react";
import MuiTextField from "@mui/material/TextField";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Input({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiTextField
      variant="standard"
      value={String(props.value ?? "")}
      placeholder={String(props.placeholder ?? "")}
      sx={sx}
      disabled={props.disabled === true}
      fullWidth={props.fullWidth === true}
      type={props.type as string | undefined}
      required={props.required === true}
      InputProps={{ readOnly: true }}
    />
  );
}
