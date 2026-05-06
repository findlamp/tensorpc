import type { ReactNode } from "react";
import MuiAccordionSummary from "@mui/material/AccordionSummary";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function AccordionSummary({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return <MuiAccordionSummary sx={sx}>{children}</MuiAccordionSummary>;
}
