import type { ReactNode } from "react";
import MuiSlider from "@mui/material/Slider";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

export function Slider({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;

  const handleChange = (_e: Event, value: number | number[]) => {
    if (compUid) sendEvent(compUid, 20 /* Change */, value);
  };

  return (
    <MuiSlider
      value={typeof props.value === "number" ? props.value : 0}
      min={typeof props.min === "number" ? props.min : 0}
      max={typeof props.max === "number" ? props.max : 100}
      step={typeof props.step === "number" ? props.step : 1}
      valueLabelDisplay="auto"
      size={props.size as "small" | "medium" | undefined}
      color={props.muiColor as "primary" | "secondary" | undefined}
      orientation={props.vertical === true ? "vertical" : "horizontal"}
      sx={sx}
      onChange={handleChange}
    />
  );
}
