import type { ReactNode } from "react";
import { ComponentNode } from "../ComponentNode";
import type { ComponentProps } from "../../hooks/useLayoutModel";
import { lookupLayoutNode } from "../../utils/layoutRefs";

type MatchCaseItem = {
  value?: unknown;
  child?: unknown;
  compUid?: unknown;
  isExpr?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUndefinedLike(value: unknown) {
  return value === undefined || value === null || value === "__undefined__";
}

function strictEqual(a: unknown, b: unknown) {
  return Object.is(a, b);
}

function childLooksEmpty(node: ComponentProps | undefined) {
  if (!node) return true;
  const props = node.props as Record<string, unknown> | undefined;
  return !Array.isArray(props?.childs) || props.childs.length === 0;
}

export function MatchCase({
  props,
  layout,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
  children: ReactNode[];
}) {
  const switchValue = props.condition ?? props.switchValue;
  const complex = isRecord(props.childsComplex) ? props.childsComplex : undefined;
  const complexItems = Array.isArray(complex?.items)
    ? (complex.items as MatchCaseItem[])
    : undefined;

  if (complexItems) {
    let defaultItem: MatchCaseItem | undefined;
    let trueItem: MatchCaseItem | undefined;
    for (const item of complexItems) {
      if (!isRecord(item)) continue;
      if (item.value === true) trueItem = trueItem ?? item;
      if (!("value" in item) || isUndefinedLike(item.value)) {
        defaultItem = defaultItem ?? item;
        continue;
      }
      if (strictEqual(item.value, switchValue)) {
        const child = lookupLayoutNode(layout, item.child);
        return child ? <ComponentNode node={child} layout={layout} /> : null;
      }
    }

    if (defaultItem) {
      const defaultChild = lookupLayoutNode(layout, defaultItem.child);
      const trueChild = trueItem ? lookupLayoutNode(layout, trueItem.child) : undefined;
      if (isUndefinedLike(switchValue) && childLooksEmpty(defaultChild) && trueChild) {
        return <ComponentNode node={trueChild} layout={layout} />;
      }
      const child = lookupLayoutNode(layout, defaultItem.child);
      return child ? <ComponentNode node={child} layout={layout} /> : null;
    }

    return null;
  }

  const cases = props.cases as Array<{ value: unknown; compUid: string }> | undefined;
  if (!cases) return null;
  for (const c of cases) {
    if (c.value === switchValue) {
      const child = lookupLayoutNode(layout, c.compUid);
      if (child) {
        return <ComponentNode node={child} layout={layout} />;
      }
    }
  }

  // Default case
  const defaultUid = props.default as string | undefined;
  if (defaultUid) {
    const child = lookupLayoutNode(layout, defaultUid);
    if (child) {
      return <ComponentNode node={child} layout={layout} />;
    }
  }

  return null;
}
