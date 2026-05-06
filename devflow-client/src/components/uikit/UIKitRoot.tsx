import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function UIKitRoot({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return (
    <div style={{ ...sx, fontFamily: "system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
