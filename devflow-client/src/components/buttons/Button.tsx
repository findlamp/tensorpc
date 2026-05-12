import type { MouseEvent, ReactNode } from "react";
import MuiButton from "@mui/material/Button";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";
import { renderIcon } from "../display/Icon";

export function Button({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!compUid) {
      console.warn("tensorpc Button clicked without compUid", props);
      return;
    }
    sendEvent(compUid, 0 /* Click */, null);
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
      startIcon={renderIcon(props.icon)}
      data-tensorpc-comp-uid={compUid}
    >
      {props.loading ? "Loading..." : children.length > 0 ? children : String(props.name ?? "")}
    </MuiButton>
  );
}
