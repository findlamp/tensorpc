import type { ReactNode } from "react";
import MuiPagination from "@mui/material/Pagination";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Pagination({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <MuiPagination
      count={typeof props.count === "number" ? props.count : 1}
      page={typeof props.value === "number" ? props.value + 1 : 1}
      color={props.muiColor as "primary" | "secondary" | "standard" | undefined}
      size={props.size as "small" | "medium" | "large" | undefined}
      variant={props.variant as "text" | "outlined" | undefined}
      shape={props.shape as "circular" | "rounded" | undefined}
      disabled={props.disabled === true}
      hideNextButton={props.hideNextButton === true}
      hidePrevButton={props.hidePrevButton === true}
      showFirstButton={props.showFirstButton === true}
      showLastButton={props.showLastButton === true}
      siblingCount={typeof props.siblingCount === "number" ? props.siblingCount : undefined}
      boundaryCount={typeof props.boundaryCount === "number" ? props.boundaryCount : undefined}
      sx={sx}
    />
  );
}
