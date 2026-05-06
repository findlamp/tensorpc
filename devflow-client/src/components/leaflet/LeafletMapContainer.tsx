import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function LeafletMapContainer({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <div
      style={{
        ...sx,
        backgroundColor: "#e8f0d8",
        borderRadius: 8,
        border: "2px solid #8ab661",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 250,
        position: "relative",
      }}
    >
      <div style={{ textAlign: "center", color: "#5a7a3a" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Map</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Install leaflet/react-leaflet</div>
      </div>
      {children}
    </div>
  );
}
