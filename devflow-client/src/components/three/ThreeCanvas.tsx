import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

/** Stub for ThreeCanvas — placeholder for future Three.js integration */
export function ThreeCanvas({
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
        border: "1px dashed #999",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        backgroundColor: "#1a1a2e",
        color: "#888",
        fontSize: 14,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎮</div>
        <div>Three.js Canvas</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>(placeholder)</div>
        {children}
      </div>
    </div>
  );
}
