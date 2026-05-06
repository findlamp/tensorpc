import type { ReactNode } from "react";
import MuiAlert from "@mui/material/Alert";
import MuiAlertTitle from "@mui/material/AlertTitle";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Alert({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiAlert
      severity={(props.severity as "error" | "warning" | "success" | "info") ?? "info"}
      variant={props.variant as "filled" | "outlined" | "standard" | undefined}
      color={props.muiColor as "error" | "warning" | "success" | "info" | undefined}
      sx={sx}
    >
      {props.title ? <MuiAlertTitle>{String(props.title)}</MuiAlertTitle> : null}
      {String(props.value ?? "")}
    </MuiAlert>
  );
}
