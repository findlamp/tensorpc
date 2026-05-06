import type { ReactNode } from "react";
import MuiSelect, { type SelectChangeEvent } from "@mui/material/Select";
import MuiMenuItem from "@mui/material/MenuItem";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function Select({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;

  const handleChange = (e: SelectChangeEvent<string>) => {
    if (compUid) sendEvent(compUid, 20 /* Change */, e.target.value);
  };

  return (
    <MuiSelect
      value={String(props.value ?? "")}
      label={String(props.label ?? "")}
      size={props.size as "small" | "medium" | undefined}
      sx={{ ...sx, minWidth: 120 }}
      onChange={handleChange}
    >
      {Array.isArray(props.items)
        ? (props.items as [string, unknown][]).map(([label, val]) => (
            <MuiMenuItem key={String(val)} value={String(val)}>
              {label}
            </MuiMenuItem>
          ))
        : null}
    </MuiSelect>
  );
}
