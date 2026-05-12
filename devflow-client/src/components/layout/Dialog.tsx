import { useCallback, useEffect, useState, type ReactNode } from "react";
import MuiDialog from "@mui/material/Dialog";
import MuiDialogTitle from "@mui/material/DialogTitle";
import MuiDialogContent from "@mui/material/DialogContent";
import { FrontendEventType } from "../../core/socketTypes";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function Dialog({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = typeof props.compUid === "string" ? props.compUid : "";
  const [localOpen, setLocalOpen] = useState(props.open === true);

  useEffect(() => {
    setLocalOpen(props.open === true);
  }, [props.open]);

  const handleClose = useCallback(() => {
    setLocalOpen(false);
    if (compUid) {
      sendEvent(compUid, FrontendEventType.ModalClose, {
        ok: false,
        userData: props.userData,
      });
    }
  }, [compUid, props.userData, sendEvent]);

  return (
    <MuiDialog
      open={localOpen}
      onClose={handleClose}
      fullScreen={props.fullScreen === true}
      fullWidth={props.fullWidth !== false}
      maxWidth={
        (props.dialogMaxWidth as "xs" | "sm" | "md" | "lg" | "xl" | false) ?? "sm"
      }
      scroll={props.scroll as "body" | "paper" | undefined}
      PaperProps={{
        sx: {
          ...sx,
          minWidth: sx.minWidth,
          minHeight: sx.minHeight,
          display: sx.display ?? "flex",
          flexDirection: sx.flexDirection ?? "column",
        },
      }}
    >
      {props.title ? (
        <MuiDialogTitle>{String(props.title)}</MuiDialogTitle>
      ) : null}
      <MuiDialogContent
        dividers={props.dividers === true}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: props.includeFormControl === false ? 0 : undefined,
        }}
      >
        {children}
      </MuiDialogContent>
    </MuiDialog>
  );
}
