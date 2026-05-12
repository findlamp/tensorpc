import type { CSSProperties, ReactNode } from "react";
import MuiTypography from "@mui/material/Typography";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Typography({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const display = props.display as CSSProperties["display"] | undefined;
  const shouldClipInlineText =
    props.noWrap === true ||
    props.variant === "caption" ||
    sx.flex !== undefined ||
    sx.flexGrow !== undefined;
  return (
    <MuiTypography
      variant={
        (props.variant as
          | "body1" | "body2" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
          | "caption" | "overline" | "subtitle1" | "subtitle2") ?? "body1"
      }
      color={props.muiColor as string | undefined}
      align={props.align as "center" | "inherit" | "justify" | "left" | "right" | undefined}
      gutterBottom={props.gutterBottom === true}
      noWrap={shouldClipInlineText}
      className={typeof props.className === "string" ? props.className : undefined}
      sx={{
        ...sx,
        display,
        minWidth: sx.minWidth ?? 0,
        maxWidth: sx.maxWidth ?? "100%",
        ...(shouldClipInlineText
          ? {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }
          : null),
      }}
    >
      {String(props.value ?? "")}
    </MuiTypography>
  );
}
