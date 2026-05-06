import Long from "long";
import { decodeHeader, encodeHeader, readHeaderMessage } from "./wsHeader";
import {
  parseSkeletonData,
  extractArraysFromBinary,
  putArraysToData,
} from "./jsonCodec";
import { SocketMsgType, FLOW_APP_EVENT, FLOW_COMMAND_NODE_EVENT } from "./socketTypes";

const EMPTY_SKELETON = JSON.stringify([0, [], []]);

function buildFrame(
  msgType: number,
  headerInit: Parameters<typeof encodeHeader>[0],
) {
  const hb = encodeHeader({ data: EMPTY_SKELETON, ...headerInit });
  const out = new Uint8Array(5 + hb.length);
  out[0] = msgType;
  new DataView(out.buffer).setInt32(1, hb.length, true);
  out.set(hb, 5);
  return out;
}

export type AppEventMessage = {
  uid: string;
  typeToEvents: [number, unknown][];
  remotePrefixes?: string[];
};

export type CommandNodeEventMessage = {
  uid: string;
  data: unknown;
};

export interface TensorPcWsOptions {
  /** Max reconnection attempts (default: 10) */
  maxReconnects?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  reconnectBaseDelay?: number;
  /** Max delay in ms (default: 30000) */
  reconnectMaxDelay?: number;
  /** Called when reconnection is attempted */
  onReconnecting?: (attempt: number) => void;
  /** Called when reconnection fails permanently */
  onReconnectFailed?: () => void;
}

export class TensorPcWs {
  private ws: WebSocket | null = null;
  private serviceMap: Record<string, number> = {};
  private onAppEventCb: ((ev: AppEventMessage) => void) | null = null;
  private onCommandNodeEventCb: ((ev: CommandNodeEventMessage) => void) | null = null;
  private options: Required<TensorPcWsOptions>;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(
    private readonly url: string,
    options: TensorPcWsOptions = {},
  ) {
    this.options = {
      maxReconnects: options.maxReconnects ?? 10,
      reconnectBaseDelay: options.reconnectBaseDelay ?? 1000,
      reconnectMaxDelay: options.reconnectMaxDelay ?? 30000,
      onReconnecting: options.onReconnecting ?? (() => {}),
      onReconnectFailed: options.onReconnectFailed ?? (() => {}),
    };
  }

  connect(): Promise<void> {
    this.intentionalClose = false;
    return this.doConnect();
  }

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let opened = false;
      const ws = new WebSocket(this.url);
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      ws.onerror = () => {
        if (!opened) reject(new Error("WebSocket error"));
      };

      ws.onopen = () => {
        opened = true;
        this.reconnectAttempt = 0;
        ws.send(buildFrame(SocketMsgType.QueryServiceIds, {}));
      };

      ws.onmessage = (m) => {
        if (!(m.data instanceof ArrayBuffer)) return;
        try {
          const wasQuery = this.handleBinary(new Uint8Array(m.data));
          if (wasQuery) {
            resolve();
          }
        } catch (e) {
          if (!opened) reject(e);
        }
      };

      ws.onclose = () => {
        if (!opened) {
          reject(new Error("WebSocket closed before open"));
          return;
        }
        // Attempt reconnection if not intentional
        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      };
    });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempt >= this.options.maxReconnects) {
      this.options.onReconnectFailed();
      return;
    }
    this.reconnectAttempt++;
    const delay = Math.min(
      this.options.reconnectBaseDelay * Math.pow(2, this.reconnectAttempt - 1),
      this.options.reconnectMaxDelay,
    );
    this.options.onReconnecting(this.reconnectAttempt);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.doConnect();
        // Re-subscribe if we had a handler
        if (this.onAppEventCb) {
          this.subscribeToAppEvents(this.onAppEventCb);
        }
        if (this.onCommandNodeEventCb) {
          this.subscribeToCommandNodeEvents(this.onCommandNodeEventCb);
        }
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  subscribeToAppEvents(handler: (ev: AppEventMessage) => void) {
    this.onAppEventCb = handler;
    this.subscribeToService(FLOW_APP_EVENT);
  }

  subscribeToCommandNodeEvents(handler: (ev: CommandNodeEventMessage) => void) {
    this.onCommandNodeEventCb = handler;
    this.subscribeToService(FLOW_COMMAND_NODE_EVENT);
  }

  private subscribeToService(serviceKey: string) {
    const sid = this.serviceMap[serviceKey];
    if (sid === undefined) {
      const keys = Object.keys(this.serviceMap).slice(0, 20);
      console.error(
        `Missing "${serviceKey}" in service map.`,
        `Available keys (first 20):`,
        keys,
      );
      throw new Error(
        `Missing ${serviceKey} in service map. Available: ${keys.join(", ") || "(none)"}`,
      );
    }
    console.log(`Subscribing to ${serviceKey} (service_id=${sid})`);
    const rpcId = Long.fromString(String(Date.now() * 1_000_000));
    const frame = buildFrame(SocketMsgType.Subscribe, {
      service_id: sid,
      rpc_id: rpcId,
      chunk_index: 0,
    });
    this.ws?.send(frame);
  }

  close() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.onAppEventCb = null;
    this.onCommandNodeEventCb = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get reconnectAttempts(): number {
    return this.reconnectAttempt;
  }

  private handleBinary(chunk: Uint8Array): boolean {
    const { type, headerBytes, rest } = readHeaderMessage(chunk);
    const hdr = decodeHeader(headerBytes) as unknown as {
      service_id: number;
      chunk_index: number;
      rpc_id: unknown;
      data: string;
    };
    const dataStr = hdr.data ?? "";

    if (type === SocketMsgType.QueryServiceIds) {
      this.serviceMap = JSON.parse(dataStr) as Record<string, number>;
      const keys = Object.keys(this.serviceMap);
      console.log(`Service map received: ${keys.length} services`, keys.slice(0, 20));
      const flowKey = FLOW_APP_EVENT;
      const found = flowKey in this.serviceMap;
      console.log(`Looking for "${flowKey}": ${found ? "FOUND" : "NOT FOUND"}`);
      console.log(
        `Looking for "${FLOW_COMMAND_NODE_EVENT}": ${
          FLOW_COMMAND_NODE_EVENT in this.serviceMap ? "FOUND" : "NOT FOUND"
        }`,
      );
      if (!found && keys.length > 0) {
        // Try to find similar keys
        const matches = keys.filter((k) => k.toLowerCase().includes("flow") || k.toLowerCase().includes("app_event"));
        console.log(`Similar keys matching "flow" or "app_event":`, matches);
      }
      return true;
    }

    const chunkIndex = Number(
      (hdr as { chunk_index?: number }).chunk_index ?? 0,
    );
    if (type === SocketMsgType.Event) {
      if (chunkIndex !== 0) {
        console.warn("Chunked Event not implemented; drop");
        return false;
      }
      const { meta, skeleton } = parseSkeletonData(dataStr);
      const arrays = extractArraysFromBinary(meta, rest);
      const decoded = putArraysToData(arrays as ArrayBufferView[], skeleton);
      const payload = decoded as unknown[];
      const appEv = payload[0] as AppEventMessage;
      const commandEv = payload[0] as CommandNodeEventMessage;
      if (appEv && Array.isArray(appEv.typeToEvents)) {
        console.log(
          `Event received: uid=${appEv.uid}, types=[${appEv.typeToEvents.map(([t]) => t).join(",")}]`,
        );
        this.onAppEventCb?.(appEv);
      } else if (commandEv && typeof commandEv.uid === "string" && "data" in commandEv) {
        this.onCommandNodeEventCb?.(commandEv);
      } else {
        console.warn("Event received but payload is unexpected:", payload);
      }
      return false;
    }

    if (type & 0xf0) {
      console.warn("tensorpc socket error frame", type, dataStr);
    }
    return false;
  }
}

export { buildFrame, EMPTY_SKELETON, FLOW_APP_EVENT };
