/** Flow graph data structures matching tensorpc.dock.serv.core */

export interface FlowNodeData {
  graphId: string;
  readableNodeId: string;
  driver?: string;
  group?: string;

  // SSH node fields
  url?: string;
  username?: string;
  password?: string;
  enablePortForward?: boolean;
  initCommands?: string;

  // App node fields
  module?: string;
  initCode?: string;
  initConfig?: string;

  // Command node fields
  args?: Array<{ value: string; enabled: boolean }>;

  // Env node fields
  key?: string;
  value?: string;

  // Group node fields
  name?: string;
  roles?: string[];
  color?: string;

  // DataStorage node fields
  inMemoryLimit?: number;

  // Markdown node fields
  pages?: Array<{ label: string; content: string }>;
  currentKey?: string;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: FlowNodeData;
  selected?: boolean;
  width?: number;
  height?: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowGraphData {
  id: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: FlowViewport;
  group?: string;
}

export interface NodeStatus {
  status: string; // "running" | "success" | "idle"
  sessionStatus: 0 | 1; // 0 = Running, 1 = Stop
}

export interface AppTemplate {
  label: string;
  module: string;
  initCode?: string;
  initConfig?: Record<string, unknown>;
  code?: string;
  group?: string;
}

export interface DockLayoutModel {
  dockLayoutModel?: unknown;
  favoriteNodes?: string[];
  appTemplates?: AppTemplate[];
}

export interface LoadGraphResponse extends DockLayoutModel {
  flows: FlowGraphData[];
  nodeStatus: Record<string, NodeStatus>;
}
