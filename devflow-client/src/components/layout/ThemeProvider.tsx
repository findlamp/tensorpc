import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function ThemeProvider({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  return <div style={sx}>{children}</div>;
}
