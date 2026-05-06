import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

/** JsonFastViewer: similar to JsonViewer but optimized for large data */
export function JsonFastViewer({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const data = props.value ?? props.data;
  const jsonStr = data != null
    ? JSON.stringify(data, null, 2)
    : "No data";

  return (
    <pre
      style={{
        ...sx,
        margin: 0,
        padding: 8,
        backgroundColor: "#1a1a2e",
        color: "#a6adc8",
        borderRadius: 4,
        fontSize: 11,
        fontFamily: "monospace",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {jsonStr}
    </pre>
  );
}
