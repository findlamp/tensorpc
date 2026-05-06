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
