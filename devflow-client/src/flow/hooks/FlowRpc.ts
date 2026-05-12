import type {
  AppNodeUrls,
  FlowGraphData,
  LoadGraphResponse,
  NodeStatus,
} from "../types";
import { AppEventType } from "../../core/socketTypes";

const FLOW_PREFIX = "tensorpc.dock.serv.core::Flow";
type SocketRpcCaller = (
  serviceKey: string,
  args: unknown[],
  timeoutMs?: number,
) => Promise<unknown>;

export function createFlowRpc(callSocketRpc: SocketRpcCaller): FlowRpcClient {
  return new FlowRpcClient(callSocketRpc);
}

export class FlowRpcClient {
  private callSocketRpc: SocketRpcCaller | null = null;

  constructor(callSocketRpc?: SocketRpcCaller) {
    this.setCaller(callSocketRpc);
  }

  setCaller(callSocketRpc?: SocketRpcCaller) {
    this.callSocketRpc = typeof callSocketRpc === "function" ? callSocketRpc : null;
  }

  private call(serviceKey: string, ...args: unknown[]) {
    if (!this.callSocketRpc) {
      return Promise.reject(new Error("Flow RPC client is not connected to the current WebSocket"));
    }
    return this.callSocketRpc(`${FLOW_PREFIX}.${serviceKey}`, args, 60_000);
  }

  // ── Graph operations ──

  async loadDefaultGraph(): Promise<LoadGraphResponse> {
    return (await this.call("load_default_graph")) as LoadGraphResponse;
  }

  async loadGraph(graphId: string): Promise<FlowGraphData> {
    return (await this.call("load_graph", graphId)) as FlowGraphData;
  }

  async saveGraph(graphId: string, flowData: FlowGraphData): Promise<void> {
    await this.call("save_graph", graphId, flowData);
  }

  async configureGraph(graphId: string, settings: { name?: string }): Promise<void> {
    await this.call("configure_graph", graphId, settings);
  }

  async deleteGraph(graphId: string): Promise<void> {
    await this.call("delete_graph", graphId);
  }

  // ── Node operations ──

  async startNode(graphId: string, nodeId: string): Promise<void> {
    await this.call("start", graphId, nodeId);
  }

  async stopNode(graphId: string, nodeId: string): Promise<void> {
    await this.call("stop", graphId, nodeId);
  }

  async stopSession(graphId: string, nodeId: string): Promise<void> {
    await this.call("stop_session", graphId, nodeId);
  }

  async queryNodeStatus(graphId: string, nodeId: string): Promise<NodeStatus> {
    return (await this.call("query_node_status", graphId, nodeId)) as NodeStatus;
  }

  // ── Terminal operations ──

  async selectNode(
    graphId: string,
    nodeId: string,
    width: number = 80,
    height: number = 24,
  ): Promise<string> {
    return (await this.call("select_node", graphId, nodeId, width, height)) as string;
  }

  async sendInput(graphId: string, nodeId: string, data: string): Promise<void> {
    await this.call("command_node_input", graphId, nodeId, data);
  }

  async saveTerminalState(
    graphId: string,
    nodeId: string,
    state: string,
    timestampMs: number,
  ): Promise<void> {
    await this.call("save_terminal_state", graphId, nodeId, state, timestampMs);
  }

  // ── App operations ──

  async queryAppState(graphId: string, nodeId: string): Promise<unknown> {
    return this.call("query_app_state", graphId, nodeId);
  }

  async queryAppNodeUrls(graphId: string, nodeId: string): Promise<AppNodeUrls | null> {
    return (await this.call("query_app_node_urls", graphId, nodeId)) as AppNodeUrls | null;
  }

  async runUiEvent(
    graphId: string,
    nodeId: string,
    compUid: string,
    eventType: number,
    data: unknown,
  ): Promise<void> {
    await this.call(
      "run_single_event",
      graphId,
      nodeId,
      AppEventType.UIEvent,
      { [compUid]: [eventType, data] },
      true,
      false,
    );
  }
}
