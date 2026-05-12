import type { MouseEvent, ReactNode } from "react";
import MuiToggleButton from "@mui/material/ToggleButton";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";
import { renderIcon } from "../display/Icon";

const CHANGE_EVENT = 20;

export function ToggleButton({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;
  const selected = props.selected === true;
  const label = String(props.label ?? props.name ?? "");
  const iconOnly = !label;

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!compUid) {
      console.warn("tensorpc ToggleButton clicked without compUid", props);
      return;
    }
    sendEvent(compUid, CHANGE_EVENT, !selected);
  };

  return (
    <MuiToggleButton
      value={String(props.value ?? label ?? compUid ?? "toggle")}
      selected={selected}
      size={props.size as "small" | "medium" | "large" | undefined}
      color={props.muiColor as "primary" | "secondary" | "error" | "info" | "success" | "warning" | undefined}
      disabled={props.disabled === true}
      sx={{
        ...(iconOnly
          ? {
              minWidth: sx.minWidth ?? 32,
              width: sx.width ?? 32,
              height: sx.height ?? 32,
              padding: sx.padding ?? "5px",
              "& .MuiSvgIcon-root": {
                fontSize: 18,
              },
            }
          : null),
        ...sx,
      }}
      onClick={handleClick}
      aria-label={label || String(props.tooltip ?? "toggle")}
      title={String(props.tooltip ?? label ?? "")}
      data-tensorpc-comp-uid={compUid}
    >
      {renderIcon(props.icon)}
      {label ? <span style={{ marginLeft: props.icon ? 6 : 0 }}>{label}</span> : null}
    </MuiToggleButton>
  );
}
