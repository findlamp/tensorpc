import type { ReactNode } from "react";
import MuiAppBar from "@mui/material/AppBar";
import MuiToolbar from "@mui/material/Toolbar";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function AppBar({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const position = (props.position as "fixed" | "absolute" | "sticky" | "static" | "relative") ?? "static";
  return (
    <MuiAppBar position={position} sx={sx}>
      <MuiToolbar>{children}</MuiToolbar>
    </MuiAppBar>
  );
}
