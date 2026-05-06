import type { ReactNode } from "react";
import MuiSwitch from "@mui/material/Switch";
import MuiFormControlLabel from "@mui/material/FormControlLabel";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function Switch({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;

  const handleChange = (_e: unknown, checked: boolean) => {
    if (compUid) sendEvent(compUid, 20 /* Change */, checked);
  };

  return (
    <MuiFormControlLabel
      control={
        <MuiSwitch
          checked={props.checked === true}
          disabled={props.disabled === true}
          size={props.size as "small" | "medium" | undefined}
          color={props.muiColor as "primary" | "secondary" | "error" | "info" | "success" | "warning" | undefined}
          onChange={handleChange}
        />
      }
      label={String(props.label ?? "")}
      labelPlacement={props.labelPlacement as "top" | "start" | "bottom" | "end" | undefined}
      sx={sx}
    />
  );
}
