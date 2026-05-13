import type { ReactNode } from "react";
import MuiListItemButton from "@mui/material/ListItemButton";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function ListItemButton({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const hasVisibleChildren = children.some((child) => child !== null && child !== undefined && child !== false);
  const hasExplicitSurface =
    sx.width !== undefined ||
    sx.height !== undefined ||
    sx.minHeight !== undefined ||
    sx.flex !== undefined ||
    sx.display !== undefined ||
    props.divider === true ||
    props.selected === true;
  if (!hasVisibleChildren && !hasExplicitSurface) {
    return null;
  }
  return (
    <MuiListItemButton
      dense={props.dense === true}
      disabled={props.disabled === true}
      disableGutters={props.disableGutters === true}
      divider={props.divider === true}
      selected={props.selected === true}
      alignItems={props.alignItems as "center" | "flex-start" | undefined}
      sx={sx}
    >
      {children}
    </MuiListItemButton>
  );
}
