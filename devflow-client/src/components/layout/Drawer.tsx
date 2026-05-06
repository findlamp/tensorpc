import type { ReactNode } from "react";
import MuiDrawer from "@mui/material/Drawer";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Drawer({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const open = props.open === true;
  const anchor = (props.anchor as "left" | "right" | "top" | "bottom") ?? "left";
  const variant = (props.variant as "permanent" | "persistent" | "temporary") ?? "temporary";
  return (
    <MuiDrawer open={open} anchor={anchor} variant={variant} sx={sx}>
      {children}
    </MuiDrawer>
  );
}
