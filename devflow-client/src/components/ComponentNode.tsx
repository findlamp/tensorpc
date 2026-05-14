import type { ReactNode } from "react";
import type { ComponentProps } from "../hooks/useLayoutModel";
import { UIType } from "../render/uiTypes";
import { childUids } from "../utils/helpers";
import { resolvePropsFromDataModel } from "../utils/dataModelBindings";
import { lookupLayoutNode, normalizeLayoutUid } from "../utils/layoutRefs";
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
  const nodeUid = typeof node.uid === "string" ? node.uid : undefined;
  const p: Record<string, unknown> = {
    ...resolvePropsFromDataModel(nodeUid ?? "", node, layout),
    compUid: node.uid ?? undefined,
  };

  // Pre-render children recursively
  const children = childUids(p).map((uid) => {
    const child = lookupLayoutNode(layout, uid);
    if (!child) {
      console.warn("tensorpc layout references missing child", uid);
      return null;
    }
    return <ComponentNode key={uid} node={child} layout={layout} />;
  });

  // For Tabs: panels come from tabDefs, while header extras are serialized in
  // childsComplex.before/after. Render those separately so control bars survive.
  const resolvedChildren =
    node.type === UIType.Tabs ? resolveTabChildren(p, layout) : children;
  if (node.type === UIType.Tabs) {
    p.__beforeNodes = resolveComplexChildren(p, layout, "before");
    p.__afterNodes = resolveComplexChildren(p, layout, "after");
  }

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
): ReactNode[] {
  const childsComplex = p.childsComplex as
    | Record<string, unknown>
    | undefined;
  const tabDefs = childsComplex?.tabDefs as
    | Array<{ label: string; value: string; component: unknown }>
    | undefined;
  if (!tabDefs) return [];
  return tabDefs.map((td) => {
    const compUid = normalizeLayoutUid(td.component ?? td.value);
    const child = lookupLayoutNode(layout, td.component ?? td.value);
    if (!child) {
      console.warn("tensorpc tab references missing child", compUid);
      return null;
    }
    return <ComponentNode key={compUid} node={child} layout={layout} />;
  });
}

function resolveComplexChildren(
  p: Record<string, unknown>,
  layout: Record<string, ComponentProps>,
  key: "before" | "after",
): ReactNode[] {
  const childsComplex = p.childsComplex as Record<string, unknown> | undefined;
  const items = Array.isArray(childsComplex?.[key])
    ? (childsComplex[key] as unknown[])
    : Array.isArray(p[key])
      ? (p[key] as unknown[])
      : [];

  return items.map((item, index) => {
    if (isComponentProps(item)) {
      return (
        <ComponentNode
          key={typeof item.uid === "string" ? item.uid : `${key}-${index}`}
          node={item}
          layout={layout}
        />
      );
    }

    const ref =
      isRecord(item)
        ? item.uid ?? item.component ?? item.compUid ?? item.child ?? item.value
        : item;
    const compUid = normalizeLayoutUid(ref);
    const child = lookupLayoutNode(layout, ref);
    if (!child) {
      console.warn("tensorpc tabs references missing header child", compUid);
      return null;
    }
    return <ComponentNode key={compUid || `${key}-${index}`} node={child} layout={layout} />;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isComponentProps(value: unknown): value is ComponentProps {
  return (
    isRecord(value) &&
    typeof value.type === "number" &&
    isRecord(value.props)
  );
}
