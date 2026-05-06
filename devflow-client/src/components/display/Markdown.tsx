import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function Markdown({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const value = typeof props.value === "string" ? props.value : String(props.value ?? "");

  return (
    <div style={{ ...sx, overflow: "auto" }}>
      <ReactMarkdown>{value}</ReactMarkdown>
    </div>
  );
}
