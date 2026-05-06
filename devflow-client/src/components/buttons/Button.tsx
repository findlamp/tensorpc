import type { ReactNode } from "react";
import MuiButton from "@mui/material/Button";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function Button({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;

  const handleClick = () => {
    if (compUid) sendEvent(compUid, 0 /* Click */, {});
  };

  return (
    <MuiButton
      variant={(props.variant as "contained" | "outlined" | "text") ?? "contained"}
      color={props.muiColor as "primary" | "secondary" | "error" | "info" | "success" | "warning" | undefined}
      disabled={props.disabled === true}
      size={props.size as "small" | "medium" | "large" | undefined}
      fullWidth={props.fullWidth === true}
      sx={sx}
      onClick={handleClick}
    >
      {props.loading ? "Loading…" : String(props.name ?? "")}
    </MuiButton>
  );
}
