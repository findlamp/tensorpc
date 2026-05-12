import type { ReactNode } from "react";
import type { ComponentProps } from "../../hooks/useLayoutModel";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { UIType } from "../../render/uiTypes";
import { childUids } from "../../utils/helpers";
import { lookupLayoutNode } from "../../utils/layoutRefs";
import { ResizableColumnPair } from "../layout/ResizableColumnPair";
import { ResizableRowPair } from "../layout/ResizableRowPair";

function tabLabelsOf(node: ComponentProps | undefined) {
  const complex = node?.props?.childsComplex;
  if (typeof complex !== "object" || complex === null) return [];
  const tabDefs = (complex as Record<string, unknown>).tabDefs;
  if (!Array.isArray(tabDefs)) return [];
  return tabDefs
    .map((tabDef) => {
      if (typeof tabDef !== "object" || tabDef === null) return "";
      const record = tabDef as Record<string, unknown>;
      return String(record.label ?? record.value ?? "");
    })
    .filter(Boolean);
}

function tabChildRefsOf(node: ComponentProps | undefined) {
  const complex = node?.props?.childsComplex;
  if (typeof complex !== "object" || complex === null) return [];
  const tabDefs = (complex as Record<string, unknown>).tabDefs;
  if (!Array.isArray(tabDefs)) return [];
  return tabDefs
    .map((tabDef) => {
      if (typeof tabDef !== "object" || tabDef === null) return "";
      const component = (tabDef as Record<string, unknown>).component;
      return typeof component === "string" ? component : "";
    })
    .filter(Boolean);
}

function subtreeHasTabLabel(
  layout: Record<string, ComponentProps>,
  uid: unknown,
  expected: string[],
  seen = new Set<string>(),
): boolean {
  const node = lookupLayoutNode(layout, uid);
  const normalizedUid = String(node?.uid ?? (typeof uid === "string" ? uid : String(uid ?? "")));
  if (!node || seen.has(normalizedUid)) return false;
  seen.add(normalizedUid);

  if (node.type === UIType.Tabs) {
    const labels = tabLabelsOf(node);
    if (labels.some((label) => expected.includes(label))) return true;
  }

  return [...childUids(node.props ?? {}), ...tabChildRefsOf(node)].some((childUid) =>
    subtreeHasTabLabel(layout, childUid, expected, seen),
  );
}

function subtreeHasType(
  layout: Record<string, ComponentProps>,
  uid: unknown,
  expected: number[],
  seen = new Set<string>(),
): boolean {
  const node = lookupLayoutNode(layout, uid);
  const normalizedUid = String(node?.uid ?? (typeof uid === "string" ? uid : String(uid ?? "")));
  if (!node || seen.has(normalizedUid)) return false;
  seen.add(normalizedUid);
  if (expected.includes(node.type)) return true;
  return [...childUids(node.props ?? {}), ...tabChildRefsOf(node)].some((childUid) =>
    subtreeHasType(layout, childUid, expected, seen),
  );
}

function isPyspySplit(
  props: Record<string, unknown>,
  layout: Record<string, ComponentProps>,
) {
  const refs = childUids(props);
  if (refs.length !== 3) return false;
  const first = lookupLayoutNode(layout, refs[0]);
  const second = lookupLayoutNode(layout, refs[1]);
  const third = lookupLayoutNode(layout, refs[2]);
  return (
    (first?.type === UIType.TanstackJsonLikeTreeView ||
      first?.type === UIType.JsonLikeTreeView) &&
    second?.type === UIType.Divider &&
    second.props?.orientation === "vertical" &&
    third !== undefined &&
    subtreeHasType(layout, refs[2], [UIType.MonacoEditor]) &&
    subtreeHasType(layout, refs[2], [UIType.AutoComplete])
  );
}

function isDistSshMasterStack(
  props: Record<string, unknown>,
  layout: Record<string, ComponentProps>,
) {
  const refs = childUids(props);
  if (refs.length !== 3) return false;
  const first = lookupLayoutNode(layout, refs[0]);
  const second = lookupLayoutNode(layout, refs[1]);
  const third = lookupLayoutNode(layout, refs[2]);
  const hasCheckpoint = subtreeHasTabLabel(layout, refs[0], ["Checkpoint"]);
  const hasProfileTabs = subtreeHasTabLabel(layout, refs[2], [
    "Remote Debug Viewer",
    "Distributed Perfetto Viewer",
    "Performance Monitor",
    "Inspector",
    "Tree",
  ]);
  return (
    second?.type === UIType.Divider &&
    third !== undefined &&
    (first?.type === UIType.ThemeProvider || hasCheckpoint) &&
    hasProfileTabs
  );
}

export function Fragment({
  props,
  layout,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
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
  const shouldWrapDistSshMasterStack = isDistSshMasterStack(props, layout);
  const shouldWrapPyspySplit = isPyspySplit(props, layout);

  if (!hasLayout && !shouldWrapDistSshMasterStack && !shouldWrapPyspySplit) return <>{children}</>;

  if (shouldWrapPyspySplit) {
    return (
      <ResizableRowPair
        initialLeft={260}
        minLeft={150}
        minRight={360}
        left={children[0]}
        right={children[2]}
      />
    );
  }

  if (shouldWrapDistSshMasterStack) {
    return (
      <div
        data-tensorpc-fragment="distssh-master-stack"
        style={{
          ...sx,
          width: sx.width ?? "100%",
          height: sx.height ?? "100%",
          flex: sx.flex ?? 1,
          minWidth: sx.minWidth ?? 0,
          minHeight: sx.minHeight ?? 0,
          display: "flex",
          flexDirection: "column",
          flexFlow: "column nowrap",
          overflow: sx.overflow ?? "hidden",
        }}
      >
        <ResizableColumnPair
          initialTop={300}
          minTop={160}
          minBottom={180}
          disabled
          top={
            <div
              data-tensorpc-fragment-slot="checkpoint"
              style={{
                width: "100%",
                height: "100%",
                flex: "1 1 0%",
                minWidth: 0,
                minHeight: 0,
                maxHeight: "100%",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {children[0]}
            </div>
          }
          bottom={
            <div
              data-tensorpc-fragment-slot="profile"
              style={{
                width: "100%",
                height: "100%",
                flex: "1 1 0%",
                minWidth: 0,
                minHeight: 0,
                maxHeight: "100%",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {children[2]}
            </div>
          }
        />
      </div>
    );
  }

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
