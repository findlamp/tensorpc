import type { ReactNode } from "react";
import MuiListItemText from "@mui/material/ListItemText";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function ListItemText({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiListItemText
      primary={String(props.value ?? "")}
      secondary={props.secondary ? String(props.secondary) : undefined}
      inset={props.inset === true}
      disableTypography={props.disableTypography === true}
      sx={sx}
    />
  );
}
