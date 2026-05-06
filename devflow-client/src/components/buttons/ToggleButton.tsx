import type { ReactNode } from "react";
import MuiButton from "@mui/material/Button";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { renderIcon } from "../display/Icon";

export function ToggleButton({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiButton
      variant="outlined"
      size={props.size as "small" | "medium" | "large" | undefined}
      sx={sx}
    >
      {renderIcon(props.icon)}
      {props.label ? String(props.label) : null}
    </MuiButton>
  );
}
