import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

/** Stub for MatrixDataGrid */
export function MatrixDataGrid({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <div style={{ ...sx, padding: 16, border: "1px dashed #444", borderRadius: 8 }}>
      <div style={{ fontWeight: 600, color: "#aaa", marginBottom: 8 }}>MatrixDataGrid</div>
      <div style={{ fontSize: 12, color: "#666" }}>Stub</div>
    </div>
  );
}
