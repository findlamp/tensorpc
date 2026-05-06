import type { ReactNode, ChangeEvent } from "react";
import MuiRadio from "@mui/material/Radio";
import MuiRadioGroup from "@mui/material/RadioGroup";
import MuiFormControlLabel from "@mui/material/FormControlLabel";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function RadioGroup({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (compUid) sendEvent(compUid, 20 /* Change */, e.target.value);
  };

  return (
    <MuiRadioGroup value={String(props.value ?? "")} row={props.row === true} sx={sx} onChange={handleChange}>
      {Array.isArray(props.names)
        ? (props.names as string[]).map((name) => (
            <MuiFormControlLabel
              key={name}
              value={name}
              control={<MuiRadio />}
              label={name}
            />
          ))
        : null}
    </MuiRadioGroup>
  );
}
