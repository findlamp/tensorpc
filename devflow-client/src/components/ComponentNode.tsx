import type { ReactNode } from "react";
import type { ComponentProps } from "../hooks/useLayoutModel";
import { childUids } from "../utils/helpers";
import { COMPONENT_REGISTRY } from "./registry";
import { ErrorBoundary } from "../context/ErrorBoundary";

/**
 * Thin router: resolves a UIType to its registered component,
 * recursively resolves children, injects uid into props, and wraps in ErrorBoundary.
 */
export function ComponentNode({
  node,
  layout,
}: {
  node: ComponentProps;
  layout: Record<string, ComponentProps>;
}): ReactNode {
  const p = { ...node.props, compUid: node.uid ?? undefined };

  // Pre-render children recursively
  const children = childUids(p).map((uid) => {
    const child = layout[uid];
    if (!child) {
      console.warn("tensorpc layout references missing child", uid);
      return null;
    }
    return <ComponentNode key={uid} node={child} layout={layout} />;
  });

  // For Tabs: children come from tabDefs, not childs
  const resolvedChildren =
    node.type === 0x31 /* Tabs */
      ? resolveTabChildren(p, layout, node)
      : children;

  const Comp = COMPONENT_REGISTRY[node.type];

  if (!Comp) {
    return (
      <div
        style={{
          border: "1px dashed #999",
          padding: 8,
          margin: 2,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600 }}>
          UIType {node.type} (not implemented)
        </div>
        <pre style={{ margin: 0, maxHeight: 120, overflow: "auto" }}>
          {JSON.stringify({ type: node.type, props: p }, null, 2)}
        </pre>
        {children}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Comp props={p} layout={layout}>
        {resolvedChildren}
      </Comp>
    </ErrorBoundary>
  );
}

/** Tabs children are resolved from childsComplex.tabDefs */
function resolveTabChildren(
  p: Record<string, unknown>,
  layout: Record<string, ComponentProps>,
  _node: ComponentProps,
): ReactNode[] {
  const childsComplex = p.childsComplex as
    | Record<string, unknown>
    | undefined;
  const tabDefs = childsComplex?.tabDefs as
    | Array<{ label: string; value: string; component: unknown }>
    | undefined;
  if (!tabDefs) return [];
  return tabDefs.map((td) => {
    const compUid = String(td.component ?? td.value);
    const child = layout[compUid];
    if (!child) {
      console.warn("tensorpc tab references missing child", compUid);
      return null;
    }
    return <ComponentNode key={compUid} node={child} layout={layout} />;
  });
}
