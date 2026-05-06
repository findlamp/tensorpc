import type { ReactNode, ChangeEvent } from "react";
import MuiTextField from "@mui/material/TextField";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function CompTextField({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (compUid) sendEvent(compUid, 22 /* InputChange */, e.target.value);
  };

  return (
    <MuiTextField
      label={String(props.label ?? "")}
      value={String(props.value ?? "")}
      placeholder={String(props.placeholder ?? "")}
      sx={sx}
      size={props.size as "small" | "medium" | undefined}
      variant={(props.variant as "filled" | "outlined" | "standard") ?? "outlined"}
      multiline={props.multiline === true}
      rows={typeof props.rows === "number" ? props.rows : undefined}
      disabled={props.disabled === true}
      error={props.error === true}
      fullWidth={props.fullWidth === true}
      type={props.type as string | undefined}
      required={props.required === true}
      color={props.muiColor as "primary" | "secondary" | "error" | "info" | "success" | "warning" | undefined}
      onChange={handleChange}
    />
  );
}
