import type { ReactNode } from "react";
import MuiButtonGroup from "@mui/material/ButtonGroup";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function ToggleButtonGroup({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return <MuiButtonGroup sx={sx}>{children}</MuiButtonGroup>;
}
