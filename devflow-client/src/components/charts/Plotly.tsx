import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

/** Stub for Plotly charts */
export function Plotly({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const data = props.data as unknown;
  if (!data) return null;

  return (
    <div
      style={{
        ...sx,
        minHeight: 300,
        border: "1px dashed var(--td-border)",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--td-text-muted)",
        fontSize: 14,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div>Plotly Chart</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Data available (install plotly.js)</div>
      </div>
    </div>
  );
}
