import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
} from "reactflow";
import "reactflow/dist/style.css";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { TensorPcContext } from "../../context/TensorPcContext";
import { LayoutContext } from "../../context/LayoutContext";
import { FrontendEventType } from "../../core/socketTypes";

type TensorpcFlowNode = {
  id?: unknown;
  type?: unknown;
  position?: { x?: unknown; y?: unknown };
  data?: Record<string, unknown>;
  width?: unknown;
  height?: unknown;
  dragHandle?: unknown;
  selected?: unknown;
  deletable?: unknown;
};

type TensorpcFlowEdge = {
  id?: unknown;
  source?: unknown;
  target?: unknown;
  sourceHandle?: unknown;
  targetHandle?: unknown;
  type?: unknown;
  style?: unknown;
};

type MenuItem = {
  id?: unknown;
  label?: unknown;
  divider?: unknown;
  disabled?: unknown;
};

type ContextMenuState = {
  x: number;
  y: number;
  title?: string;
  items: MenuItem[];
  kind: "pane" | "node";
  nodeId?: string;
  flowPosition?: { x: number; y: number };
} | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isDefinedValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function firstArray<T>(...values: unknown[]): T[] {
  for (const value of values) {
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function extractFlowData(props: Record<string, unknown>) {
  const childDef = isRecord(props.childsComplex) ? props.childsComplex : {};
  const nestedFlow = isRecord(childDef.flow) ? childDef.flow : {};
  return {
    nodes: firstArray<TensorpcFlowNode>(
      childDef.nodes,
      props.nodes,
      nestedFlow.nodes,
    ),
    edges: firstArray<TensorpcFlowEdge>(
      childDef.edges,
      props.edges,
      nestedFlow.edges,
    ),
  };
}

function childUidList(props: Record<string, unknown>) {
  return Array.isArray(props.childs)
    ? props.childs.map((uid) => String(uid))
    : [];
}

function nodeLabel(node: TensorpcFlowNode) {
  const data = isRecord(node.data) ? node.data : {};
  if (typeof data.label === "string" && data.label) return data.label;
  return String(node.id ?? node.type ?? "Node");
}

function toRfEdge(edge: TensorpcFlowEdge, index: number): Edge {
  const source = String(edge.source ?? "");
  const target = String(edge.target ?? "");
  return {
    id: String(edge.id ?? `${source}-${target}-${index}`),
    source,
    target,
    sourceHandle: isDefinedValue(edge.sourceHandle)
      ? String(edge.sourceHandle)
      : undefined,
    targetHandle: isDefinedValue(edge.targetHandle)
      ? String(edge.targetHandle)
      : undefined,
    type: "bezier",
    style: {
      stroke: "#b7beca",
      strokeWidth: 1.7,
      ...(isRecord(edge.style) ? edge.style : {}),
    },
  };
}

function newEdgeFromConnection(connection: Connection, index: number): TensorpcFlowEdge | null {
  if (!connection.source || !connection.target) return null;
  const sourceHandle = connection.sourceHandle ?? undefined;
  const targetHandle = connection.targetHandle ?? undefined;
  const handleKey = [sourceHandle ?? "out", targetHandle ?? "in"].join("-");
  return {
    id: `${connection.source}-${connection.target}-${handleKey}-${Date.now().toString(36)}-${index}`,
    source: connection.source,
    target: connection.target,
    sourceHandle,
    targetHandle,
  };
}

function cssValue(value: unknown) {
  if (typeof value === "number") return `${value}px`;
  if (typeof value === "string") return value;
  return undefined;
}

function camelToKebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function flowClassCss(props: Record<string, unknown>) {
  return Object.entries(props)
    .filter(([key, value]) => key.startsWith(".") && isRecord(value))
    .map(([selector, style]) => {
      const body = Object.entries(style as Record<string, unknown>)
        .map(([key, value]) => {
          const css = cssValue(value);
          return css === undefined ? "" : `${camelToKebab(key)}:${css};`;
        })
        .filter(Boolean)
        .join("");
      return `${selector}{${body}}`;
    })
    .join("\n");
}

function toRfNode(
  node: TensorpcFlowNode,
  index: number,
  renderedComponent: ReactNode | undefined,
  defaultContextMenuItems: MenuItem[] = [],
  screenToFlowPosition = false,
  viewport?: Viewport,
  basePatch?: Record<string, unknown>,
  dataPatch?: Record<string, unknown>,
): Node {
  const sourceNode = basePatch ? { ...node, ...basePatch } : node;
  const id = String(sourceNode.id ?? `node-${index}`);
  const data = {
    ...(isRecord(sourceNode.data) ? sourceNode.data : {}),
    ...(dataPatch ?? {}),
  };
  const label = nodeLabel({ ...sourceNode, data });
  const isJsonInput = label.toLowerCase().includes("json input");
  const width = numberOr(sourceNode.width, 180);
  const hasExplicitHeight =
    typeof sourceNode.height === "number" && Number.isFinite(sourceNode.height);
  const height = Math.max(
    numberOr(sourceNode.height, renderedComponent ? 72 : 74),
    isJsonInput ? 132 : renderedComponent ? 72 : 74,
  );
  const sourcePosition = {
    x: numberOr(sourceNode.position?.x, 80 + index * 180),
    y: numberOr(sourceNode.position?.y, 80 + (index % 3) * 120),
  };
  const position =
    screenToFlowPosition && viewport
      ? {
          x: (sourcePosition.x - viewport.x) / viewport.zoom,
          y: (sourcePosition.y - viewport.y) / viewport.zoom,
        }
      : sourcePosition;
  return {
    id,
    type: "tensorpc",
    position,
    data: {
      ...data,
      __nodeId: id,
      label,
      renderedComponent,
      contextMenuItems: Array.isArray(data.contextMenuItems)
        ? data.contextMenuItems
        : defaultContextMenuItems,
    },
    dragHandle:
      typeof sourceNode.dragHandle === "string" ? sourceNode.dragHandle : undefined,
    selected: Boolean(sourceNode.selected),
    deletable: sourceNode.deletable !== false,
    width,
    height,
    style: {
      width,
      ...(renderedComponent && hasExplicitHeight
        ? { height }
        : { minHeight: height }),
    },
  };
}

function FlowComponentNode({ data, selected }: NodeProps<Record<string, unknown>>) {
  const renderedComponent = data.renderedComponent as ReactNode | undefined;
  if (renderedComponent) {
    return (
      <div
        data-tensorpc-flow-node-id={
          typeof data.__nodeId === "string" ? data.__nodeId : undefined
        }
        style={{
          width: "100%",
          minHeight: "inherit",
          cursor: "pointer",
          overflow: "visible",
        }}
      >
        {renderedComponent}
      </div>
    );
  }
  return (
    <div
      data-tensorpc-flow-node-id={
        typeof data.__nodeId === "string" ? data.__nodeId : undefined
      }
      style={{
        minWidth: 150,
        border: selected ? "1px solid var(--td-blue)" : "1px solid var(--td-border)",
        borderRadius: 6,
        background: "var(--td-node-bg)",
        color: "var(--td-node-text)",
        boxShadow: "0 2px 7px var(--td-shadow)",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <div style={{ padding: "5px 10px", background: "var(--td-node-header)", fontWeight: 650 }}>
        {String(data.label ?? "Node")}
      </div>
      <div style={{ padding: 10, fontSize: 12, color: "var(--td-text-muted)" }}>ready</div>
    </div>
  );
}

const nodeTypes = { tensorpc: FlowComponentNode };
const flowViewportMemory = new Map<string, Viewport>();
const FlowControlType = {
  AddNewNodes: 2,
  DeleteNodeByIds: 3,
  UpdateNodeInternals: 4,
  UpdateBaseNodeModel: 5,
  UpdateNodeData: 6,
  DeleteEdgeByIds: 8,
  UpdatePaneContextMenuItem: 9,
  AddNewEdges: 14,
  SwitchFlow: 15,
} as const;

function nodeAllowsEditor(node: Node | undefined) {
  if (!node) return false;
  const label = String(node.data?.label ?? node.id ?? "").toLowerCase();
  if (label.includes("json input")) return false;
  if (label.includes("viewer")) return false;
  return true;
}

function selectionKeyNodeId(selectionKey: string | null) {
  if (!selectionKey) return null;
  return selectionKey.split(":")[0] || null;
}

function emitSelection(nodeId: string | null, openEditor = false) {
  window.dispatchEvent(
    new CustomEvent("tensorpc-flow-node-selection", {
      detail: { nodeId, openEditor },
    }),
  );
}

function emitGraphMutation() {
  window.dispatchEvent(new CustomEvent("tensorpc-flow-graph-mutated"));
}

function flowNodeIdFromTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return null;
  const componentNode = element.closest("[data-tensorpc-flow-node-id]");
  const componentNodeId = componentNode?.getAttribute("data-tensorpc-flow-node-id");
  if (componentNodeId) return componentNodeId;
  const reactFlowNode = element.closest(".react-flow__node[data-id]");
  const reactFlowNodeId = reactFlowNode?.getAttribute("data-id");
  return reactFlowNodeId || null;
}

function isDeleteMenuItem(item: MenuItem) {
  const text = `${String(item.id ?? "")} ${String(item.label ?? "")}`.toLowerCase();
  return (
    text.includes("delete") ||
    text.includes("remove") ||
    text.includes("del ") ||
    text.includes("删除")
  );
}

function ContextMenu({
  menu,
  onSelect,
}: {
  menu: ContextMenuState;
  onSelect: (item: MenuItem) => void;
}) {
  if (!menu) return null;
  return (
    <div
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        left: menu.x,
        top: menu.y,
        minWidth: 230,
        background: "var(--td-surface)",
        border: "1px solid var(--td-border)",
        boxShadow: "0 8px 26px var(--td-shadow)",
        borderRadius: 4,
        zIndex: 1000,
        color: "var(--td-text)",
        fontSize: 14,
        padding: "6px 0",
      }}
    >
      {menu.title && (
        <div
          style={{
            padding: "8px 16px 10px",
            fontWeight: 600,
            textAlign: "center",
            borderBottom: "1px solid var(--td-border-soft)",
          }}
        >
          {menu.title}
        </div>
      )}
      {menu.items.map((item, index) =>
        item.divider ? (
          <div key={`divider-${index}`} style={{ height: 1, background: "var(--td-border-soft)", margin: "6px 0" }} />
        ) : (
          <button
            key={String(item.id ?? index)}
            type="button"
            disabled={Boolean(item.disabled)}
            onClick={() => {
              onSelect(item);
            }}
            style={{
              display: "block",
              width: "100%",
              border: 0,
              background: "transparent",
              textAlign: "left",
              padding: "8px 16px",
              color: item.disabled ? "var(--td-text-muted)" : "var(--td-text)",
              cursor: item.disabled ? "default" : "pointer",
              font: "inherit",
            }}
          >
            {String(item.label ?? item.id ?? "")}
          </button>
        ),
      )}
    </div>
  );
}

type FlowProps = {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
};

function FlowInner({
  props,
  children,
}: FlowProps) {
  const sx = useFlexStyles(props);
  const { sendUiEvent } = useContext(TensorPcContext);
  const { graphId, nodeId } = useContext(LayoutContext);
  const { nodes, edges } = useMemo(() => extractFlowData(props), [props]);
  const childUids = useMemo(() => childUidList(props), [props]);
  const childMap = useMemo(() => {
    const map = new Map<string, ReactNode>();
    childUids.forEach((uid, index) => map.set(uid, children[index]));
    return map;
  }, [childUids, children]);
  const defaultNodeContextMenuItems = useMemo(
    () =>
      Array.isArray(props.nodeContextMenuItems)
        ? (props.nodeContextMenuItems as MenuItem[])
        : [],
    [props.nodeContextMenuItems],
  );
  const positionOverridesRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const baseModelPatchesRef = useRef<Map<string, Record<string, unknown>>>(
    new Map(),
  );
  const dataPatchesRef = useRef<Map<string, Record<string, unknown>>>(
    new Map(),
  );
  const deletedNodeIdsRef = useRef<Set<string>>(new Set());
  const sourceNodes = useMemo(
    () =>
      nodes
        .filter((node) => !deletedNodeIdsRef.current.has(String(node.id ?? "")))
        .map((node, index) => {
          const nodeId = String(node.id ?? `node-${index}`);
          const basePatch = baseModelPatchesRef.current.get(nodeId);
          const dataPatch = dataPatchesRef.current.get(nodeId);
          const patchedData = {
            ...(isRecord(node.data) ? node.data : {}),
            ...(dataPatch ?? {}),
          };
          const componentUid = typeof patchedData.component === "string"
            ? patchedData.component
            : isRecord(node.data) && typeof node.data.component === "string"
            ? node.data.component
            : "";
          const rfNode = toRfNode(
            node,
            index,
            childMap.get(componentUid),
            defaultNodeContextMenuItems,
            false,
            undefined,
            basePatch,
            dataPatch,
          );
          const position = positionOverridesRef.current.get(rfNode.id);
          return position ? { ...rfNode, position } : rfNode;
        }),
    [nodes, childMap, defaultNodeContextMenuItems],
  );
  const sourceEdges = useMemo(
    () =>
      edges
        .map(toRfEdge)
        .filter(
          (edge) =>
            edge.source.length > 0 &&
            edge.target.length > 0 &&
            !deletedNodeIdsRef.current.has(edge.source) &&
            !deletedNodeIdsRef.current.has(edge.target),
        ),
    [edges],
  );
  const [rfNodes, setRfNodes] = useState<Node[]>(sourceNodes);
  const [rfEdges, setRfEdges] = useState<Edge[]>(sourceEdges);
  const [paneMenuItems, setPaneMenuItems] = useState<MenuItem[]>(() =>
    Array.isArray(props.paneContextMenuItems)
      ? (props.paneContextMenuItems as MenuItem[])
      : [],
  );
  const compUid = typeof props.compUid === "string" ? props.compUid : "";
  const [initialViewport] = useState<Viewport | undefined>(() =>
    compUid ? flowViewportMemory.get(compUid) : undefined,
  );
  const [menu, setMenu] = useState<ContextMenuState>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSelectionRef = useRef<string | null>(null);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const suppressSelectionRef = useRef(false);
  const updateNodeInternals = useUpdateNodeInternals();

  const panePointToFlowPosition = useCallback((point: { x: number; y: number }) => {
    const viewport = flowInstanceRef.current?.getViewport();
    if (!viewport) return point;
    return {
      x: (point.x - viewport.x) / viewport.zoom,
      y: (point.y - viewport.y) / viewport.zoom,
    };
  }, []);

  const handleWheelZoom = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (props.zoomOnScroll === false) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest(".tensorpc-flow-surface")) return;
      if (
        target.closest(
          [
            ".react-flow__controls",
            ".react-flow__minimap",
            ".monaco-editor",
            "[data-tensorpc-terminal]",
            "[data-tensorpc-app-terminal]",
            "input",
            "textarea",
            "select",
            "[contenteditable='true']",
          ].join(","),
        )
      ) {
        return;
      }
      const instance = flowInstanceRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!instance || !rect) return;
      event.preventDefault();
      event.stopPropagation();

      const viewport = instance.getViewport();
      const minZoom = numberOr(props.minZoom, 0.2);
      const maxZoom = numberOr(props.maxZoom, 4);
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);
      const nextZoom = clamp(viewport.zoom * zoomFactor, minZoom, maxZoom);
      if (Math.abs(nextZoom - viewport.zoom) < 0.0001) return;

      const paneX = event.clientX - rect.left;
      const paneY = event.clientY - rect.top;
      const flowX = (paneX - viewport.x) / viewport.zoom;
      const flowY = (paneY - viewport.y) / viewport.zoom;
      const nextViewport = {
        x: paneX - flowX * nextZoom,
        y: paneY - flowY * nextZoom,
        zoom: nextZoom,
      };
      void instance.setViewport(nextViewport, { duration: 0 });
      if (compUid) flowViewportMemory.set(compUid, nextViewport);
    },
    [compUid, props.maxZoom, props.minZoom, props.zoomOnScroll],
  );

  const refreshNodeInternals = useCallback(
    (nodeIds: string[]) => {
      const refresh = () => nodeIds.forEach((id) => updateNodeInternals(id));
      window.requestAnimationFrame(refresh);
      window.setTimeout(refresh, 80);
      window.setTimeout(refresh, 240);
    },
    [updateNodeInternals],
  );

  useEffect(() => {
    setRfNodes(sourceNodes);
    refreshNodeInternals(sourceNodes.map((node) => node.id));
  }, [refreshNodeInternals, sourceNodes]);
  useEffect(() => setRfEdges(sourceEdges), [sourceEdges]);
  useEffect(() => {
    setPaneMenuItems(
      Array.isArray(props.paneContextMenuItems)
        ? (props.paneContextMenuItems as MenuItem[])
        : [],
    );
  }, [props.paneContextMenuItems]);

  useEffect(() => {
    if (typeof props.compUid !== "string") return;
    const handleComponentEvent = (event: Event) => {
      const custom = event as CustomEvent<{ uid?: string; data?: unknown }>;
      if (custom.detail?.uid !== props.compUid || !isRecord(custom.detail.data)) return;
      const data = custom.detail.data;
      const type = Number(data.type);
      if (type === FlowControlType.AddNewNodes && Array.isArray(data.nodes)) {
        const viewport = flowInstanceRef.current?.getViewport();
        const shouldConvertPosition = Boolean(data.screenToFlowPosition);
        const newNodes = (data.nodes as TensorpcFlowNode[]).map((node, index) => {
          const componentUid = isRecord(node.data) && typeof node.data.component === "string"
            ? node.data.component
            : "";
          const rfNode = toRfNode(
            node,
            index,
            childMap.get(componentUid),
            defaultNodeContextMenuItems,
            shouldConvertPosition,
            viewport,
          );
          if (shouldConvertPosition) {
            positionOverridesRef.current.set(rfNode.id, {
              x: rfNode.position.x,
              y: rfNode.position.y,
            });
          }
          if (data.isOverride) {
            baseModelPatchesRef.current.delete(rfNode.id);
            dataPatchesRef.current.delete(rfNode.id);
          }
          deletedNodeIdsRef.current.delete(rfNode.id);
          return rfNode;
        });
        setRfNodes((current) => {
          const next = Boolean(data.isOverride)
            ? newNodes
            : [...current.filter((node) => !newNodes.some((n) => n.id === node.id)), ...newNodes];
          return next;
        });
        emitGraphMutation();
      } else if (type === FlowControlType.DeleteNodeByIds && Array.isArray(data.nodeIds)) {
        const ids = new Set(data.nodeIds.map(String));
        ids.forEach((id) => {
          deletedNodeIdsRef.current.add(id);
          positionOverridesRef.current.delete(id);
          baseModelPatchesRef.current.delete(id);
          dataPatchesRef.current.delete(id);
        });
        setRfNodes((current) => current.filter((node) => !ids.has(node.id)));
        setRfEdges((current) =>
          current.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target)),
        );
        const currentSelectionId = selectionKeyNodeId(lastSelectionRef.current);
        if (currentSelectionId && ids.has(currentSelectionId)) {
          lastSelectionRef.current = null;
          emitSelection(null);
        }
        emitGraphMutation();
      } else if (type === FlowControlType.AddNewEdges && Array.isArray(data.edges)) {
        const nextEdges = (data.edges as TensorpcFlowEdge[]).map(toRfEdge);
        setRfEdges((current) => (data.isOverride ? nextEdges : [...current, ...nextEdges]));
        emitGraphMutation();
      } else if (type === FlowControlType.DeleteEdgeByIds && Array.isArray(data.edgeIds)) {
        const ids = new Set(data.edgeIds.map(String));
        setRfEdges((current) => current.filter((edge) => !ids.has(edge.id)));
        emitGraphMutation();
      } else if (type === FlowControlType.SwitchFlow) {
        const switchNodes = Array.isArray(data.nodes)
          ? (data.nodes as TensorpcFlowNode[])
          : [];
        const switchIds = new Set(switchNodes.map((node) => String(node.id ?? "")));
        deletedNodeIdsRef.current.forEach((id) => {
          if (!switchIds.has(id)) deletedNodeIdsRef.current.delete(id);
        });
        const nextNodes = switchNodes
          .filter((node) => !deletedNodeIdsRef.current.has(String(node.id ?? "")))
          .map((node, index) => {
              const nodeId = String(node.id ?? `node-${index}`);
              const basePatch = baseModelPatchesRef.current.get(nodeId);
              const dataPatch = dataPatchesRef.current.get(nodeId);
              const patchedData = {
                ...(isRecord(node.data) ? node.data : {}),
                ...(dataPatch ?? {}),
              };
              const componentUid = isRecord(node.data) && typeof node.data.component === "string"
                ? node.data.component
                : typeof patchedData.component === "string"
                ? patchedData.component
                : "";
              return toRfNode(
                node,
                index,
                childMap.get(componentUid),
                defaultNodeContextMenuItems,
                false,
                undefined,
                basePatch,
                dataPatch,
              );
            })
        const nextEdges = Array.isArray(data.edges)
          ? (data.edges as TensorpcFlowEdge[])
              .map(toRfEdge)
              .filter(
                (edge) =>
                  !deletedNodeIdsRef.current.has(edge.source) &&
                  !deletedNodeIdsRef.current.has(edge.target),
              )
          : [];
        setRfNodes(nextNodes);
        setRfEdges(nextEdges);
      } else if (
        type === FlowControlType.UpdateNodeInternals &&
        Array.isArray(data.nodeIds)
      ) {
        const nodeIds = data.nodeIds.map(String);
        setRfNodes((current) =>
          current.map((node) => {
            if (!nodeIds.includes(node.id)) return node;
            const currentVersion =
              typeof node.data?.__internalsVersion === "number"
                ? node.data.__internalsVersion
                : 0;
            return {
              ...node,
              data: {
                ...node.data,
                __internalsVersion: currentVersion + 1,
              },
            };
          }),
        );
        refreshNodeInternals(nodeIds);
      } else if (
        (type === FlowControlType.UpdateBaseNodeModel || type === FlowControlType.UpdateNodeData) &&
        data.nodeId !== undefined &&
        isRecord(data.data)
      ) {
        const ids = Array.isArray(data.nodeId) ? data.nodeId.map(String) : [String(data.nodeId)];
        const patch = data.data;
        const patchMap =
          type === FlowControlType.UpdateNodeData ? dataPatchesRef.current : baseModelPatchesRef.current;
        ids.forEach((id) => {
          patchMap.set(id, {
            ...(patchMap.get(id) ?? {}),
            ...patch,
          });
        });
        setRfNodes((current) =>
          current.map((node) =>
            ids.includes(node.id)
              ? {
                  ...node,
                  ...(type === FlowControlType.UpdateBaseNodeModel ? patch : {}),
                  data:
                    type === FlowControlType.UpdateNodeData
                      ? { ...node.data, ...patch }
                      : node.data,
                }
              : node,
          ),
        );
      } else if (
        type === FlowControlType.UpdatePaneContextMenuItem &&
        Array.isArray(data.menuItems)
      ) {
        const updates = data.menuItems as MenuItem[];
        setPaneMenuItems((current) => {
          if (current.length === 0) return updates;
          return current.map((item) => {
            const update = updates.find((candidate) => candidate.id === item.id);
            return update ? { ...item, ...update } : item;
          });
        });
      }
    };
    window.addEventListener("tensorpc-component-event", handleComponentEvent);
    return () => window.removeEventListener("tensorpc-component-event", handleComponentEvent);
  }, [childMap, defaultNodeContextMenuItems, props.compUid, refreshNodeInternals]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((current) => {
      const next = applyNodeChanges(changes, current);
      const selectedNodes = next.filter((node) => node.selected);
      if (selectedNodes.length <= 1) return next;
      const latestSelectedChange = [...changes]
        .reverse()
        .find(
          (change) =>
            change.type === "select" &&
            "selected" in change &&
            change.selected === true,
        );
      const keepSelectedId =
        latestSelectedChange && "id" in latestSelectedChange
          ? String(latestSelectedChange.id)
          : selectedNodes[selectedNodes.length - 1]?.id;
      return next.map((node) =>
        node.id === keepSelectedId ? node : { ...node, selected: false },
      );
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const sendFlowEvent = useCallback(
    (eventType: number, payload: unknown) => {
      if (!graphId || !nodeId || !compUid) return;
      void sendUiEvent(graphId, nodeId, compUid, eventType, payload);
    },
    [compUid, graphId, nodeId, sendUiEvent],
  );

  const sendFlowVisChange = useCallback(
    (nextNodes: Node[]) => {
      if (!graphId || !nodeId || !compUid) return;
      const positionById = new Map(
        nextNodes.map((node) => [
          node.id,
          { x: node.position.x, y: node.position.y },
        ]),
      );
      const sizeById = new Map(
        nextNodes.map((node) => [
          node.id,
          { width: node.width, height: node.height },
        ]),
      );
      const serializedNodes = nodes.map((node) => {
        const id = String(node.id ?? "");
        const position = positionById.get(id) ?? {
          x: numberOr(node.position?.x, 0),
          y: numberOr(node.position?.y, 0),
        };
        const size = sizeById.get(id);
        return {
          ...node,
          position,
          ...(typeof size?.width === "number" ? { width: size.width } : {}),
          ...(typeof size?.height === "number" ? { height: size.height } : {}),
        };
      });
      void sendUiEvent(
        graphId,
        nodeId,
        compUid,
        FrontendEventType.FlowVisChange,
        { nodes: serializedNodes },
      );
    },
    [compUid, graphId, nodeId, nodes, sendUiEvent],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = newEdgeFromConnection(connection, rfEdges.length);
      if (!newEdge) return;
      setRfEdges((current) => [...current, toRfEdge(newEdge, current.length)]);
      sendFlowEvent(FrontendEventType.FlowEdgeConnection, { newEdge });
      window.setTimeout(emitGraphMutation, 120);
      window.setTimeout(emitGraphMutation, 600);
    },
    [rfEdges.length, sendFlowEvent],
  );

  const selectNode = useCallback(
    (selectedId: string | null, openEditor = false) => {
      const selectionKey = `${selectedId ?? ""}:${openEditor ? "editor" : "node"}`;
      if (lastSelectionRef.current === selectionKey) return;
      lastSelectionRef.current = selectionKey;
      emitSelection(selectedId, openEditor);
    },
    [],
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      const items = paneMenuItems;
      const panePoint = {
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0),
      };
      if (items.length > 0) {
        setMenu({
          x: panePoint.x,
          y: panePoint.y,
          title: "Manage Compute Flow",
          items,
          kind: "pane",
          flowPosition: panePointToFlowPosition(panePoint),
        });
      }
    },
    [paneMenuItems, panePointToFlowPosition],
  );

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    suppressSelectionRef.current = true;
    window.setTimeout(() => {
      suppressSelectionRef.current = false;
    }, 120);
    const rect = containerRef.current?.getBoundingClientRect();
    const panePoint = {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
    const items = Array.isArray(node.data?.contextMenuItems)
      ? (node.data.contextMenuItems as MenuItem[])
      : [];
    if (items.length > 0) {
      setMenu({
        x: panePoint.x,
        y: panePoint.y,
        title: String(node.id),
        items,
        kind: "node",
        nodeId: String(node.id),
        flowPosition: panePointToFlowPosition(panePoint),
      });
    }
  }, [panePointToFlowPosition]);

  const onMenuSelect = useCallback(
    (item: MenuItem) => {
      if (!menu || !graphId || !nodeId || !compUid) {
        console.warn("Flow context menu ignored: missing app graph context", {
          graphId,
          nodeId,
          compUid,
        });
        return;
      }
      const itemId = String(item.id ?? "");
      if (!itemId || item.disabled) return;
      const payload = {
        itemId,
        mouseX: menu.x,
        mouseY: menu.y,
        clientOffset: { x: menu.x, y: menu.y },
        flowPosition: menu.flowPosition,
        ...(menu.kind === "node" ? { nodeId: menu.nodeId } : {}),
      };
      const eventType =
        menu.kind === "node"
          ? FrontendEventType.FlowNodeContextMenu
          : FrontendEventType.FlowPaneContextMenu;
      if (menu.kind === "node" && menu.nodeId && isDeleteMenuItem(item)) {
        const deletedId = menu.nodeId;
        deletedNodeIdsRef.current.add(deletedId);
        positionOverridesRef.current.delete(deletedId);
        setRfNodes((current) => current.filter((node) => node.id !== deletedId));
        setRfEdges((current) =>
          current.filter((edge) => edge.source !== deletedId && edge.target !== deletedId),
        );
        if (selectionKeyNodeId(lastSelectionRef.current) === deletedId) selectNode(null);
      }
      void sendUiEvent(graphId, nodeId, compUid, eventType, payload);
      window.setTimeout(emitGraphMutation, 120);
      window.setTimeout(emitGraphMutation, 600);
      setMenu(null);
    },
    [compUid, graphId, menu, nodeId, selectNode, sendUiEvent],
  );

  const classCss = useMemo(() => flowClassCss(props), [props]);

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={(event) => {
        const selectedId = flowNodeIdFromTarget(event.target);
        if (selectedId && event.button !== 0) {
          event.stopPropagation();
          return;
        }
      }}
      onMouseDownCapture={(event) => {
        const selectedId = flowNodeIdFromTarget(event.target);
        if (selectedId && event.button !== 0) {
          event.stopPropagation();
          return;
        }
      }}
      onWheelCapture={handleWheelZoom}
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height: sx.height ?? "100%",
        minHeight: sx.minHeight ?? 360,
        background: "var(--td-flow-bg)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>
        {`
          .tensorpc-flow-surface .react-flow__node {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            border-radius: 12px;
            overflow: visible;
            filter: drop-shadow(0 8px 18px var(--td-shadow));
            outline: none !important;
            box-shadow: none !important;
          }
          .tensorpc-flow-surface .react-flow__node:focus,
          .tensorpc-flow-surface .react-flow__node:focus-visible,
          .tensorpc-flow-surface .react-flow__node.selected {
            outline: none !important;
            box-shadow: none !important;
          }
          .tensorpc-flow-surface .react-flow__node > div {
            border-radius: 12px;
            overflow: visible;
          }
          .tensorpc-flow-surface .react-flow__node,
          .tensorpc-flow-surface .react-flow__node * {
            box-sizing: border-box;
            max-width: 100%;
            min-width: 0;
          }
          .tensorpc-flow-surface .react-flow__node p,
          .tensorpc-flow-surface .react-flow__node span,
          .tensorpc-flow-surface .react-flow__node div {
            overflow-wrap: anywhere;
            word-break: normal;
          }
          .tensorpc-flow-surface .react-flow__node textarea {
            box-sizing: border-box;
            display: block;
            width: 100%;
            max-width: 100%;
            min-height: 56px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            resize: none;
          }
          .tensorpc-flow-surface .react-flow__node input[type="text"],
          .tensorpc-flow-surface .react-flow__node input:not([type]) {
            box-sizing: border-box;
            width: 100%;
            max-width: 100%;
            min-width: 0;
          }
          .tensorpc-flow-surface .react-flow__handle {
            width: 10px;
            height: 10px;
            border: 1.5px solid #ff4e48;
            background: var(--td-node-bg);
          }
          .tensorpc-flow-surface .react-flow__node,
          .tensorpc-flow-surface .react-flow__node > div,
          .tensorpc-flow-surface .ComputeFlowNodeWrapper {
            color: var(--td-node-text) !important;
          }
          .tensorpc-flow-surface .ComputeFlowNodeWrapper {
            background: var(--td-node-bg) !important;
            box-shadow: 0 8px 22px var(--td-shadow) !important;
          }
          .tensorpc-flow-surface .react-flow__node.selected .ComputeFlowNodeWrapper {
            outline: 1px solid var(--td-blue);
            outline-offset: 0;
          }
          .tensorpc-flow-surface .ComputeFlowHeader {
            background: var(--td-node-header) !important;
            color: var(--td-node-text) !important;
            border-color: var(--td-border) !important;
          }
          .tensorpc-flow-surface .ComputeFlowNodeItem,
          .tensorpc-flow-surface .ComputeFlowIOHandleContainer,
          .tensorpc-flow-surface .ComputeFlowBottomStatus {
            background: var(--td-node-bg) !important;
            color: var(--td-node-text) !important;
            border-color: var(--td-border) !important;
          }
          .tensorpc-flow-surface .ComputeFlowCodeTypography,
          .tensorpc-flow-surface .MuiTypography-root,
          .tensorpc-flow-surface .MuiBox-root,
          .tensorpc-flow-surface .MuiInputBase-root,
          .tensorpc-flow-surface .MuiInputBase-input {
            color: var(--td-node-text) !important;
          }
          .tensorpc-flow-surface input,
          .tensorpc-flow-surface textarea {
            background: var(--td-input-bg) !important;
            color: var(--td-node-text) !important;
            border-color: var(--td-input-border) !important;
          }
          .tensorpc-flow-surface .ComputeFlowIOHandleBase {
            background: var(--td-node-bg) !important;
          }
          .tensorpc-flow-surface .react-flow__handle-top,
          .tensorpc-flow-surface .react-flow__resize-control.handle.top,
          .tensorpc-flow-surface .react-flow__resize-control.line.top {
            display: none !important;
          }
          .tensorpc-flow-surface .react-flow__edge-path {
            stroke: color-mix(in srgb, var(--td-text-muted) 65%, var(--td-blue));
            stroke-width: 1.7;
          }
          .tensorpc-flow-surface .react-flow__controls {
            box-shadow: 0 10px 24px var(--td-shadow);
            border: 1px solid var(--td-border);
            border-radius: 8px;
            overflow: hidden;
            background: var(--td-surface-2);
          }
          .tensorpc-flow-surface .react-flow__controls-button {
            border-bottom: 1px solid var(--td-border-soft);
            background: var(--td-surface-3);
            color: var(--td-text-strong);
            fill: var(--td-text-strong);
          }
          .tensorpc-flow-surface .react-flow__controls-button:hover {
            background: var(--td-active);
          }
          .tensorpc-flow-surface .react-flow__controls-button svg {
            fill: currentColor;
          }
          .tensorpc-flow-surface textarea {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }
          .tensorpc-flow-surface {
            background-color: var(--td-flow-bg);
          }
          .tensorpc-flow-surface .react-flow__pane {
            background-image: radial-gradient(circle, var(--td-flow-dot) 1.2px, transparent 1.35px);
            background-size: 24px 24px;
            background-position: 0 0;
          }
          .tensorpc-flow-surface .react-flow__background {
            opacity: 0.78;
          }
        `}
      </style>
      {classCss && <style>{classCss}</style>}
      <ReactFlow
        className="tensorpc-flow-surface"
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance: ReactFlowInstance) => {
          flowInstanceRef.current = instance;
          if (!compUid) return;
          requestAnimationFrame(() => {
            flowViewportMemory.set(compUid, instance.getViewport());
          });
        }}
        onMoveEnd={(_event, viewport) => {
          if (compUid) flowViewportMemory.set(compUid, viewport);
        }}
        onNodeDragStart={(_event, node) => {
          setRfNodes((current) =>
            current.map((item) =>
              item.id === node.id
                ? { ...item, selected: true }
                : item.selected
                ? { ...item, selected: false }
                : item,
            ),
          );
        }}
        onNodeDragStop={(_event, _node, draggedNodes) => {
          const changed = new Map(
            draggedNodes.map((draggedNode) => [
              draggedNode.id,
              {
                x: draggedNode.position.x,
                y: draggedNode.position.y,
              },
            ]),
          );
          setRfNodes((current) => {
            const next = current.map((node) => {
              const position = changed.get(node.id);
              if (!position) return node;
              positionOverridesRef.current.set(node.id, position);
              return { ...node, position };
            });
            sendFlowVisChange(next);
            return next;
          });
        }}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={() => {
          setMenu(null);
          selectNode(null);
        }}
        onNodeClick={(event, node) => {
          if (event.button !== 0) return;
          setMenu(null);
          selectNode(String(node.id), nodeAllowsEditor(node));
        }}
        onSelectionChange={({ nodes: selectedNodes }) => {
          if (suppressSelectionRef.current) return;
          const selectedId = selectedNodes[0]?.id ? String(selectedNodes[0].id) : null;
          if (selectedId === null) {
            return;
          }
          selectNode(selectedId, false);
        }}
        onNodesDelete={(deletedNodes) => {
          if (deletedNodes.length === 0) return;
          deletedNodes.forEach((node) => {
            deletedNodeIdsRef.current.add(node.id);
            positionOverridesRef.current.delete(node.id);
          });
          selectNode(null);
          sendFlowEvent(FrontendEventType.FlowNodeDelete, {
            nodesToDel: deletedNodes.map((node) => ({ id: node.id })),
          });
          window.setTimeout(emitGraphMutation, 120);
          window.setTimeout(emitGraphMutation, 600);
        }}
        onEdgesDelete={(deletedEdges) => {
          if (deletedEdges.length === 0) return;
          sendFlowEvent(FrontendEventType.FlowEdgeDelete, {
            edgesToDel: deletedEdges.map((edge) => ({ id: edge.id })),
          });
        }}
        nodeTypes={nodeTypes}
        defaultViewport={initialViewport}
        fitView={props.fitView !== false && initialViewport === undefined}
        nodesDraggable={props.nodesDraggable !== false}
        nodesConnectable={props.nodesConnectable !== false}
        elementsSelectable={props.elementsSelectable !== false}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        selectionOnDrag={false}
        selectNodesOnDrag={false}
        panOnDrag={props.panOnDrag !== false}
        panActivationKeyCode={null}
        panOnScroll={props.zoomOnScroll === false && props.panOnScroll === true}
        zoomOnScroll={props.zoomOnScroll !== false}
        zoomOnDoubleClick
        defaultEdgeOptions={{ type: "bezier", style: { stroke: "var(--td-text-muted)", strokeWidth: 1.7 } }}
        style={{ background: "var(--td-flow-bg)" }}
      >
        <Background color="var(--td-flow-dot)" gap={24} size={1.25} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor="#0808ff"
          maskColor="var(--td-minimap-mask)"
          style={{
            width: 190,
            height: 122,
            background: "var(--td-surface)",
            border: "1px solid var(--td-border)",
          }}
        />
      </ReactFlow>
      <ContextMenu
        menu={menu}
        onSelect={onMenuSelect}
      />
    </div>
  );
}

export function Flow(flowProps: FlowProps) {
  return (
    <ReactFlowProvider>
      <FlowInner {...flowProps} />
    </ReactFlowProvider>
  );
}
