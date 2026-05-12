import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

function numberProp(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function displayValue(value: number, fractionDigits: unknown) {
  const digits =
    typeof fractionDigits === "number" && Number.isFinite(fractionDigits)
      ? Math.max(0, Math.min(8, fractionDigits))
      : 0;
  return value.toFixed(digits);
}

export function BlenderSlider({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;
  const min = numberProp(props.min, 0);
  const max = numberProp(props.max, min + 1);
  const step = numberProp(props.step, 1);
  const propValue = numberProp(props.value ?? props.defaultValue, min);
  const [draftValue, setDraftValue] = useState(propValue);
  const value = props.value === undefined ? draftValue : propValue;
  const pct = useMemo(() => {
    const span = max - min;
    if (span <= 0) return 0;
    return Math.max(0, Math.min(100, ((value - min) / span) * 100));
  }, [max, min, value]);

  if (max <= min && value === min) {
    return null;
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    setDraftValue(next);
    if (compUid) sendEvent(compUid, 20 /* Change */, next);
  };

  return (
    <div
      style={{
        ...sx,
        width: sx.width ?? "100%",
        minWidth: sx.minWidth ?? 0,
        height: sx.height ?? 24,
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflow: "hidden",
        color: "#444",
        fontSize: 11,
      }}
    >
      {props.showStep === true && (
        <span style={{ flexShrink: 0 }}>Step-{displayValue(value, props.fractionDigits)}</span>
      )}
      <div
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          height: 14,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "4px 0",
            borderRadius: 2,
            background: "#c8d7f1",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: props.indicatorColor as string | undefined ?? "#5c7fc4",
            }}
          />
        </div>
        <input
          aria-label="Blender slider"
          disabled={props.disabled === true}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          style={{
            position: "relative",
            width: "100%",
            height: 14,
            margin: 0,
            opacity: 0,
            cursor: props.disabled === true ? "default" : "pointer",
          }}
        />
      </div>
      {props.showTotal === true && (
        <span style={{ flexShrink: 0 }}>
          {displayValue(value, props.fractionDigits)} / {displayValue(max, props.fractionDigits)}
        </span>
      )}
    </div>
  );
}
