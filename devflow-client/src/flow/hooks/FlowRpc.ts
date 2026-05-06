import { encodeRpcRequest, decodeRpcReply } from "../../core/rpcClient";
import { putArraysToData } from "../../core/jsonCodec";
import type {
  FlowGraphData,
  LoadGraphResponse,
  NodeStatus,
} from "../types";

const FLOW_PREFIX = "tensorpc.dock.serv.core::Flow";
const JSON_ARRAY_FLAG = 0x10;
const ENCODE_METHOD_MASK = 0xff;

async function callRpc(
  serviceKey: string,
  args: unknown[],
): Promise<unknown> {
  const rpcReq = {
    service_key: serviceKey,
    data: JSON.stringify([args, {}]),
    flags: 0,
  };
  console.log(`RPC → ${serviceKey}`, { args });
  const body = encodeRpcRequest(rpcReq);
  const resp = await fetch(`/api/rpc`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/octet-stream" },
  });
  console.log(`RPC ← ${serviceKey} HTTP ${resp.status}`);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error(`RPC ${serviceKey} failed: HTTP ${resp.status}`, text);
    throw new Error(`RPC ${serviceKey} failed: HTTP ${resp.status}`);
  }
  const respBuf = new Uint8Array(await resp.arrayBuffer());
  const reply = decodeRpcReply(respBuf);
  if (reply.exception) {
    console.error(`RPC ${serviceKey} error:`, reply.exception);
    throw new Error(`RPC ${serviceKey} error: ${reply.exception}`);
  }
  if (reply.data != null) {
    const skeleton = JSON.parse(reply.data) as unknown;
    const arrays = (reply.arrays ?? []).map((array) => array.data);
    const decoded =
      ((reply.flags ?? 0) & ENCODE_METHOD_MASK) === JSON_ARRAY_FLAG
        ? putArraysToData(arrays, skeleton)
        : skeleton;
    if (
      Array.isArray(decoded) &&
      Array.isArray(decoded[0]) &&
      decoded[0].length > 0
    ) {
      return decoded[0][0];
    }
    if (Array.isArray(decoded) && decoded.length > 0) {
      return decoded[0];
    }
    return decoded;
  }
  return null;
}

export function createFlowRpc(): FlowRpcClient {
  return new FlowRpcClient();
}

export class FlowRpcClient {
  private call(serviceKey: string, ...args: unknown[]) {
    return callRpc(`${FLOW_PREFIX}.${serviceKey}`, args);
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

  async runUiEvent(
    graphId: string,
    nodeId: string,
    compUid: string,
    eventType: number,
    data: unknown,
  ): Promise<void> {
    await this.call("run_ui_event", graphId, nodeId, { [compUid]: [eventType, data] }, false);
  }
}
