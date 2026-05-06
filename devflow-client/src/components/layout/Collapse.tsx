import type { ReactNode } from "react";
import MuiCollapse from "@mui/material/Collapse";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Collapse({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiCollapse
      in={props.triggered === true}
      orientation={props.orientation as "horizontal" | "vertical" | undefined}
      timeout={typeof props.timeout === "number" ? props.timeout : undefined}
      collapsedSize={typeof props.collapsedSize === "number" ? props.collapsedSize : undefined}
      unmountOnExit={props.unmountOnExit === true}
      sx={sx}
    >
      <div>{children}</div>
    </MuiCollapse>
  );
}
