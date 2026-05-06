import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

/** Stub for Video player */
export function VideoPlayer({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const url = props.url as string | undefined;

  if (url) {
    return (
      <video
        src={url}
        controls
        style={{ ...sx, width: "100%", height: "100%", backgroundColor: "#000" }}
      />
    );
  }

  return (
    <div
      style={{
        ...sx,
        backgroundColor: "#111",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#666",
        minHeight: 200,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
        <div>Video Player</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>(no source)</div>
      </div>
    </div>
  );
}
