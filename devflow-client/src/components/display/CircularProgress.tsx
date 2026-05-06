import type { ReactNode } from "react";
import MuiCircularProgress from "@mui/material/CircularProgress";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function CircularProgress({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiCircularProgress
      variant={(props.variant as "determinate" | "indeterminate") ?? "indeterminate"}
      value={typeof props.value === "number" ? props.value : undefined}
      color={props.muiColor as "primary" | "secondary" | "error" | "info" | "success" | "warning" | undefined}
      size={typeof props.size === "number" ? props.size : typeof props.size === "string" ? props.size : undefined}
      thickness={typeof props.thickness === "number" ? props.thickness : undefined}
      sx={sx}
    />
  );
}
