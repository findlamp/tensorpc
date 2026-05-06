import type { ReactNode } from "react";
import MuiDivider from "@mui/material/Divider";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function CompDivider({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiDivider
      orientation={props.orientation as "horizontal" | "vertical" | undefined}
      sx={sx}
    />
  );
}
