import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function BlenderSlider({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <div style={{ ...sx, padding: 16, border: "1px dashed #555", borderRadius: 8, color: "#888", fontSize: 13 }}>
      BlenderSlider (stub)
    </div>
  );
}
