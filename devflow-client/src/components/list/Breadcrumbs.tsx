import type { ReactNode } from "react";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import MuiLink from "@mui/material/Link";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Breadcrumbs({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiBreadcrumbs
      maxItems={typeof props.maxItems === "number" ? props.maxItems : undefined}
      itemsAfterCollapse={typeof props.itemsAfterCollapse === "number" ? props.itemsAfterCollapse : undefined}
      itemsBeforeCollapse={typeof props.itemsBeforeCollapse === "number" ? props.itemsBeforeCollapse : undefined}
      sx={sx}
    >
      {Array.isArray(props.value)
        ? (props.value as string[]).map((item, i) => (
            <MuiLink key={i} underline="hover" color="inherit" href="#">
              {item}
            </MuiLink>
          ))
        : null}
    </MuiBreadcrumbs>
  );
}
