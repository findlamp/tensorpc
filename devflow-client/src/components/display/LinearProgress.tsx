import type { ReactNode } from "react";
import MuiLinearProgress from "@mui/material/LinearProgress";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function LinearProgress({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiLinearProgress
      variant={(props.variant as "determinate" | "indeterminate" | "buffer" | "query") ?? "indeterminate"}
      value={typeof props.value === "number" ? props.value : undefined}
      valueBuffer={typeof props.valueBuffer === "number" ? props.valueBuffer : undefined}
      color={props.muiColor as "primary" | "secondary" | "error" | "info" | "success" | "warning" | undefined}
      sx={sx}
    />
  );
}
