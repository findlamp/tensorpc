import type { ReactNode } from "react";

export function Fragment({
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  return <>{children}</>;
}
