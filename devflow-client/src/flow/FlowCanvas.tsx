import { useCallback, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type Viewport,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "./nodes/CustomNode";
import type { FlowGraphData, FlowNode, FlowEdge } from "./types";

interface FlowCanvasProps {
  graph: FlowGraphData | null;
  onNodeSelect?: (nodeId: string | null) => void;
}

function toRfNode(n: FlowNode): Node {
  return {
    id: n.id,
    type: "custom",
    position: n.position,
    data: { ...n.data, nodeType: n.type },
    selected: n.selected,
  };
}

function toRfEdge(e: FlowEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: "bezier",
    style: { stroke: "#8ea0b7", strokeWidth: 1.8 },
  };
}

const flowEditorViewportMemory = new Map<string, Viewport>();

export function FlowCanvas({ graph, onNodeSelect }: FlowCanvasProps) {
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const graphId = graph?.id ?? "default";
  const [initialViewport] = useState<Viewport | undefined>(() => {
    if (!graph) return undefined;
    return flowEditorViewportMemory.get(graph.id) ?? graph.viewport;
  });

  // Sync graph data to ReactFlow state whenever graph changes
  useEffect(() => {
    console.log("FlowCanvas useEffect: graph changed", {
      hasGraph: !!graph,
      nodes: graph?.nodes.length,
      edges: graph?.edges.length,
      graphId: graph?.id,
    });
    if (graph) {
      const newNodes = graph.nodes.map(toRfNode);
      const newEdges = graph.edges.map(toRfEdge);
      console.log("FlowCanvas: setting rfNodes", newNodes.length, "rfEdges", newEdges.length);
      setRfNodes(newNodes);
      setRfEdges(newEdges);
    }
  }, [graph]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds));
    },
    [],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setRfEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setRfEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "bezier",
            style: { stroke: "#8ea0b7", strokeWidth: 1.8 },
          },
          eds,
        ),
      );
    },
    [],
  );

  const onSelectionChange = useCallback(
    ({ nodes }: { nodes: Node[] }) => {
      onNodeSelect?.(nodes[0]?.id ?? null);
    },
    [onNodeSelect],
  );

  if (!graph) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
          background: "#1a1a2e",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔀</div>
        <div style={{ fontSize: 14 }}>No graph loaded</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
          Click a node type on the left to create your first node.
        </div>
      </div>
    );
  }

  if (rfNodes.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
          background: "#1a1a2e",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
        <div style={{ fontSize: 14 }}>Empty graph</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
          Graph "{graph.id}" has {graph.nodes?.length ?? 0} nodes.
          <br />
          Click a node type on the left to add one.
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", background: "#1a1a2e" }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onInit={(instance: ReactFlowInstance) => {
          window.requestAnimationFrame(() => {
            flowEditorViewportMemory.set(graphId, instance.getViewport());
          });
        }}
        onMoveEnd={(_event, viewport) => {
          flowEditorViewportMemory.set(graphId, viewport);
        }}
        nodeTypes={nodeTypes}
        defaultViewport={initialViewport}
        fitView={false}
        panOnScroll={false}
        zoomOnScroll
        zoomOnDoubleClick
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={{ type: "bezier" }}
        style={{ background: "#1a1a2e" }}
      >
        <Background color="#333" gap={20} />
        <Controls />
        <MiniMap
          style={{ background: "#1e1e2e" }}
          nodeColor={(n) => {
            const type = (n.data as Record<string, unknown>)?.nodeType as string ?? "";
            const colors: Record<string, string> = {
              directssh: "#4fc3f7",
              command: "#81c784",
              app: "#ce93d8",
              env: "#ffb74d",
              datastorage: "#4db6ac",
            };
            return colors[type] || "#666";
          }}
        />
      </ReactFlow>
    </div>
  );
}
