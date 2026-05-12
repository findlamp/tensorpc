import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function JsonViewer({
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
    : "";

  return (
    <pre
      style={{
        ...sx,
        margin: 0,
        padding: 12,
        backgroundColor: "var(--td-surface-2)",
        color: "var(--td-text)",
        border: "1px solid var(--td-border)",
        borderRadius: 4,
        fontSize: 12,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {jsonStr}
    </pre>
  );
}
