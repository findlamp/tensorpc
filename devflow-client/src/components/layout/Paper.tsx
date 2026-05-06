import type { ReactNode } from "react";
import MuiPaper from "@mui/material/Paper";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Paper({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiPaper
      sx={sx}
      elevation={typeof props.elevation === "number" ? props.elevation : 1}
      variant={props.variant as "elevation" | "outlined" | undefined}
      square={props.square === true}
    >
      {children}
    </MuiPaper>
  );
}
