import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

/** Stub for DataGrid */
export function DataGrid({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <div style={{ ...sx, padding: 16, border: "1px dashed #444", borderRadius: 8, overflow: "auto" }}>
      <div style={{ fontWeight: 600, color: "#aaa", marginBottom: 8 }}>DataGrid</div>
      <div style={{ fontSize: 12, color: "#666" }}>
        Stub — connect to a tensorpc DataModel for live data
      </div>
      {children}
    </div>
  );
}
