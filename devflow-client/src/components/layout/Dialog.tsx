import type { ReactNode } from "react";
import MuiDialog from "@mui/material/Dialog";
import MuiDialogTitle from "@mui/material/DialogTitle";
import MuiDialogContent from "@mui/material/DialogContent";

export function Dialog({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  return (
    <MuiDialog
      open={props.open === true}
      fullScreen={props.fullScreen === true}
      fullWidth={props.fullWidth !== false}
      maxWidth={
        (props.dialogMaxWidth as "xs" | "sm" | "md" | "lg" | "xl" | false) ?? "sm"
      }
      scroll={props.scroll as "body" | "paper" | undefined}
    >
      {props.title ? (
        <MuiDialogTitle>{String(props.title)}</MuiDialogTitle>
      ) : null}
      <MuiDialogContent dividers={props.dividers === true}>
        {children}
      </MuiDialogContent>
    </MuiDialog>
  );
}
