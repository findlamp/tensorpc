import type { ReactNode } from "react";
import MuiChip from "@mui/material/Chip";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { renderIcon } from "../display/Icon";

export function Chip({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const iconNode = renderIcon(props.icon);
  return (
    <MuiChip
      label={String(props.label ?? "")}
      icon={iconNode != null ? (iconNode as React.ReactElement) : undefined}
      color={props.muiColor as "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" | undefined}
      size={props.size as "small" | "medium" | undefined}
      variant={props.variant as "filled" | "outlined" | undefined}
      onClick={props.clickable === true ? () => {} : undefined}
      onDelete={props.deletable === true ? () => {} : undefined}
      sx={sx}
    />
  );
}
