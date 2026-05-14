import type { ReactNode } from "react";
import { ComponentNode } from "../ComponentNode";
import type { ComponentProps } from "../../hooks/useLayoutModel";
import { lookupLayoutNode } from "../../utils/layoutRefs";
import { componentChildUids } from "../../utils/dataModelBindings";
import { UIType } from "../../render/uiTypes";
import {
  cmClusterKey,
  useCmClusterSelection,
} from "./cmSelectionState";

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

function selectedCmCluster(
  layout: Record<string, ComponentProps>,
  selection: { key?: string; value?: unknown },
) {
  if (!selection.key) return undefined;
  for (const node of Object.values(layout)) {
    const dataObject = node.props?.dataObject;
    if (!isRecord(dataObject)) continue;
    const current = isRecord(dataObject.cur_cluster)
      ? dataObject.cur_cluster
      : isRecord(selection.value)
        ? selection.value
        : undefined;
    if (
      current &&
      cmClusterKey(current) === selection.key &&
      typeof current.name === "string" &&
      typeof current.provider === "string" &&
      typeof current.num_nodes === "number" &&
      "num_cpu" in current &&
      "num_gpu" in current
    ) {
      return current;
    }
  }
  if (
    isRecord(selection.value) &&
    typeof selection.value.name === "string" &&
    typeof selection.value.provider === "string"
  ) {
    return selection.value;
  }
  return undefined;
}

function subtreeHasType(
  layout: Record<string, ComponentProps>,
  uid: unknown,
  types: Set<number>,
  seen = new Set<string>(),
): boolean {
  const node = lookupLayoutNode(layout, uid);
  const key = String(node?.uid ?? uid ?? "");
  if (!node || seen.has(key)) return false;
  seen.add(key);
  if (types.has(node.type)) return true;
  return componentChildUids(node).some((childUid) =>
    subtreeHasType(layout, childUid, types, seen),
  );
}

function shouldRenderSelectedClusterPreview(
  layout: Record<string, ComponentProps>,
  items: MatchCaseItem[] | undefined,
) {
  if (!items) return false;
  const trueItem = items.find((item) => isRecord(item) && item.value === true);
  if (!trueItem) return false;
  return !subtreeHasType(
    layout,
    trueItem.child,
    new Set([UIType.Terminal, UIType.MenuList, UIType.MonacoEditor, UIType.Tabs]),
  );
}

function numberField(item: Record<string, unknown>, key: string) {
  const value = item[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clusterTagLabels(item: Record<string, unknown>) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return tags
    .map((tag) => (isRecord(tag) && typeof tag.label === "string" ? tag.label : ""))
    .filter(Boolean);
}

function CmCodeValue({ value }: { value: string | number }) {
  return (
    <code
      style={{
        minWidth: 16,
        textAlign: "center",
        borderRadius: 4,
        padding: "0 5px",
        background: "var(--td-surface-3)",
        color: "var(--td-text-strong)",
        fontFamily: "inherit",
        fontSize: "0.92em",
      }}
    >
      {value}
    </code>
  );
}

function CmClusterCard({ cluster }: { cluster: Record<string, unknown> }) {
  const cpuRemain = numberField(cluster, "num_cpu_remaining");
  const gpuRemain = numberField(cluster, "num_gpu_remaining");
  const labels = clusterTagLabels(cluster);
  return (
    <div
      data-tensorpc-cm-selected-cluster=""
      style={{
        width: "calc(100% - 10px)",
        boxSizing: "border-box",
        border: "1px solid color-mix(in srgb, var(--td-border), var(--td-text) 45%)",
        borderRadius: 3,
        background: "color-mix(in srgb, var(--td-surface), var(--td-text) 8%)",
        color: "var(--td-text)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.06), 0 2px 8px rgba(0, 0, 0, 0.45)",
        margin: "6px 5px 10px",
      }}
    >
      <div
        style={{
          minHeight: 26,
          display: "flex",
          alignItems: "center",
          padding: "3px 6px 2px",
          fontSize: 13,
          color: "var(--td-text-strong)",
          background: "color-mix(in srgb, var(--td-surface), var(--td-text) 12%)",
        }}
      >
        {String(cluster.name)} @ {String(cluster.provider)}
      </div>
      <div style={{ height: 1, background: "color-mix(in srgb, var(--td-border), var(--td-text) 40%)" }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "2px 5px", fontSize: 14 }}>
        <span><CmCodeValue value={numberField(cluster, "num_nodes")} /> Nodes,</span>
        <span><CmCodeValue value={`${cpuRemain}/${numberField(cluster, "num_cpu")}`} /> CPUs,</span>
        <span><CmCodeValue value={`${gpuRemain}/${numberField(cluster, "num_gpu")}`} /> GPUs</span>
      </div>
      <div style={{ height: 1, background: "color-mix(in srgb, var(--td-border), var(--td-text) 40%)" }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "4px 5px" }}>
        {(labels.length > 0 ? labels : ["GPU"]).map((label) => (
          <span
            key={label}
            style={{
              borderRadius: 999,
              padding: "2px 10px",
              background: "#4f8f45",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.25,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
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
  const cmSelection = useCmClusterSelection();
  const cmCluster = selectedCmCluster(layout, cmSelection);

  if (cmCluster && shouldRenderSelectedClusterPreview(layout, complexItems)) {
    return <CmClusterCard cluster={cmCluster} />;
  }

  if (complexItems) {
    let defaultItem: MatchCaseItem | undefined;
    for (const item of complexItems) {
      if (!isRecord(item)) continue;
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
      if (isUndefinedLike(switchValue) && childLooksEmpty(defaultChild)) return null;
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
