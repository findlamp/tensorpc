import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function IFrame({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <iframe
      src={typeof props.url === "string" ? props.url : undefined}
      title={typeof props.title === "string" ? props.title : undefined}
      style={{ ...sx, border: "none", width: "100%", height: "100%" }}
    />
  );
}
