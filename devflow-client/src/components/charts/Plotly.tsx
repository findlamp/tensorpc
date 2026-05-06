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
  return (
    <div
      style={{
        ...sx,
        minHeight: 300,
        border: "1px dashed #555",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#888",
        fontSize: 14,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
        <div>Plotly Chart</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>
          {data ? "Data available (install plotly.js)" : "No data"}
        </div>
      </div>
    </div>
  );
}
