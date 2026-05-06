import type { ReactNode } from "react";
import MuiList from "@mui/material/List";
import MuiTypography from "@mui/material/Typography";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function MUIListComp({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiList
      dense={props.dense === true}
      disablePadding={props.disablePadding === true}
      subheader={
        props.subheader ? (
          <MuiTypography variant="subtitle2">{String(props.subheader)}</MuiTypography>
        ) : undefined
      }
      sx={sx}
    >
      {children}
    </MuiList>
  );
}
