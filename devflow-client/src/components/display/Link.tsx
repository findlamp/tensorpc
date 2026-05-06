import type { ReactNode } from "react";
import MuiLink from "@mui/material/Link";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Link({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiLink
      href={props.href as string ?? "#"}
      underline={props.underline as "always" | "hover" | "none" | undefined}
      color={props.muiColor as string | undefined}
      sx={sx}
    >
      {String(props.value ?? "")}
    </MuiLink>
  );
}
