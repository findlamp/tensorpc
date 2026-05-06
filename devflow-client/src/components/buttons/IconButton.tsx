import type { ReactNode } from "react";
import MuiTooltip from "@mui/material/Tooltip";
import MuiIconButton from "@mui/material/IconButton";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { renderIcon } from "../display/Icon";
import { useSendEvent } from "../../hooks/useSendEvent";

export function IconButton({
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
    <MuiTooltip title={props.tooltip ? String(props.tooltip) : ""}>
      <MuiIconButton
        size={props.size as "small" | "medium" | "large" | undefined}
        color={props.muiColor as "primary" | "secondary" | "error" | "info" | "success" | "warning" | undefined}
        disabled={props.disabled === true}
        sx={sx}
        onClick={handleClick}
      >
        {renderIcon(props.icon)}
      </MuiIconButton>
    </MuiTooltip>
  );
}
