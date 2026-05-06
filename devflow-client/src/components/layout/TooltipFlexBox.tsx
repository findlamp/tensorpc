import type { ReactNode } from "react";
import MuiTooltip from "@mui/material/Tooltip";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function TooltipFlexBox({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiTooltip
      title={String(props.title ?? "")}
      placement={
        props.placement as "top" | "right" | "left" | "bottom" | undefined
      }
      arrow={props.arrow === true}
      followCursor={props.followCursor === true}
    >
      <div style={sx}>{children}</div>
    </MuiTooltip>
  );
}
