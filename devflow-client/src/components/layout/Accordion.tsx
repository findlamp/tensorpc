import type { ReactNode } from "react";
import MuiAccordion from "@mui/material/Accordion";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Accordion({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiAccordion
      expanded={props.expanded === true}
      disabled={props.disabled === true}
      square={props.square === true}
      disableGutters={props.disableGutters === true}
      sx={sx}
      onChange={() => {}}
    >
      {children}
    </MuiAccordion>
  );
}
