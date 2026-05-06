import type { ReactNode } from "react";
import MuiListItemIcon from "@mui/material/ListItemIcon";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { renderIcon } from "../display/Icon";

export function ListItemIconComp({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiListItemIcon sx={sx}>
      {renderIcon(props.icon)}
      {children}
    </MuiListItemIcon>
  );
}
