import { type ReactNode } from "react";

/**
 * Minimal FlexLayout rendering.
 *
 * The real FlexLayout is a golden-layout-style docking panel with rows,
 * tab-sets, tabs, drag-and-drop, etc. This stub renders all child
 * components in a simple flex column so the content is visible.
 */
export function FlexLayout({
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  if (children.length === 0) {
    return <div style={{ width: "100%", height: "100%" }} />;
  }

  // Single child: render it directly, taking full space
  if (children.length === 1) {
    return (
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
        {children[0]}
      </div>
    );
  }

  // Multiple children: stack them vertically
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {children.map((child, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
            minWidth: 0,
            borderBottom:
              i < children.length - 1 ? "1px solid #333" : undefined,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
