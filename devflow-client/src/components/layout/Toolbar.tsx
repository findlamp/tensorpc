import type { ReactNode } from "react";
import MuiToolbar from "@mui/material/Toolbar";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Toolbar({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return <MuiToolbar sx={sx}>{children}</MuiToolbar>;
}
