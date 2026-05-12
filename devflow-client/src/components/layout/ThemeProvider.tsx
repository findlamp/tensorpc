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
  const hasLayout =
    sx.width !== undefined ||
    sx.height !== undefined ||
    sx.flex !== undefined ||
    sx.flexGrow !== undefined ||
    sx.flexFlow !== undefined ||
    sx.flexDirection !== undefined ||
    sx.overflow !== undefined;

  if (!hasLayout) return <>{children}</>;

  return (
    <div
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height: sx.height ?? "100%",
        flex: sx.flex ?? 1,
        minWidth: sx.minWidth ?? 0,
        minHeight: sx.minHeight ?? 0,
        display: sx.display ?? "flex",
        flexDirection: sx.flexDirection ?? "column",
        flexFlow: sx.flexFlow ?? "column nowrap",
        overflow: sx.overflow ?? "hidden",
      }}
    >
      {children}
    </div>
  );
}
