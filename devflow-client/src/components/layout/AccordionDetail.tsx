import type { ReactNode } from "react";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function AccordionDetail({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return <MuiAccordionDetails sx={sx}>{children}</MuiAccordionDetails>;
}
