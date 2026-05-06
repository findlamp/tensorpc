import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function DynamicControls({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <div style={{ ...sx, padding: 8, border: "1px dashed #444", borderRadius: 4 }}>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>DynamicControls</div>
      {children}
    </div>
  );
}
