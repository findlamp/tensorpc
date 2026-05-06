import type { ReactNode } from "react";

export function FlowNodeToolbar({
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  return <>{children}</>;
}
