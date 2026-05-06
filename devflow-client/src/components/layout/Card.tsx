import type { ReactNode } from "react";
import MuiCard from "@mui/material/Card";
import MuiCardContent from "@mui/material/CardContent";
import MuiTypography from "@mui/material/Typography";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Card({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const cardTitle = props.title as string | undefined;
  return (
    <MuiCard sx={sx}>
      {cardTitle && (
        <MuiTypography variant="h6" sx={{ p: 2, pb: 1 }}>
          {cardTitle}
        </MuiTypography>
      )}
      <MuiCardContent>{children}</MuiCardContent>
    </MuiCard>
  );
}
