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

type PendingChunkedEvent = {
  headerData: string;
  serviceId: number;
  numChunks: number;
  chunks: Map<number, Uint8Array>;
};

type PendingRpc = {
  headerData: string;
  serviceId: number;
  numChunks: number;
  chunks: Map<number, Uint8Array>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
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
  private eventChunkPendings = new Map<string, PendingChunkedEvent>();
  private rpcPendings = new Map<string, PendingRpc>();
  private subscribedServices = new Set<string>();
  private options: Required<TensorPcWsOptions>;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(
    private url: string,
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
      this.subscribedServices.clear();
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
        this.url = withFreshClientId(this.url);
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

  async call(serviceKey: string, args: unknown[], timeoutMs = 30_000): Promise<unknown> {
    await this.waitUntilConnected(Math.min(timeoutMs, 5_000));
    const sid = this.serviceMap[serviceKey];
    if (sid === undefined) {
      throw new Error(`Missing ${serviceKey} in service map`);
    }

    const rpcId = Long.fromNumber(Date.now()).mul(1_000_000).add(
      Math.floor(Math.random() * 1_000_000),
    );
    const rpcIdKey = rpcId.toString();
    const frame = buildFrame(SocketMsgType.RPC, {
      service_id: sid,
      rpc_id: rpcId,
      chunk_index: 0,
      data: JSON.stringify([[], [args, {}]]),
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rpcPendings.delete(rpcIdKey);
        reject(new Error(`RPC ${serviceKey} timeout`));
      }, timeoutMs);
      this.rpcPendings.set(rpcIdKey, {
        headerData: "",
        serviceId: sid,
        numChunks: 0,
        chunks: new Map(),
        resolve,
        reject,
        timer,
      });
      this.ws?.send(frame);
    });
  }

  async notify(serviceKey: string, args: unknown[]) {
    await this.waitUntilConnected(5_000);
    const sid = this.serviceMap[serviceKey];
    if (sid === undefined) {
      const keys = Object.keys(this.serviceMap).slice(0, 20);
      throw new Error(
        `Missing ${serviceKey} in service map. Available: ${keys.join(", ") || "(none)"}`,
      );
    }
    const rpcId = Long.fromNumber(Date.now()).mul(1_000_000).add(
      Math.floor(Math.random() * 1_000_000),
    );
    const frame = buildFrame(SocketMsgType.Notification, {
      service_id: sid,
      rpc_id: rpcId,
      chunk_index: 0,
      data: JSON.stringify([[], [args, {}]]),
    });
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    ws.send(frame);
  }

  waitUntilConnected(timeoutMs = 5_000): Promise<void> {
    if (this.isConnected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (this.isConnected) {
          window.clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          window.clearInterval(timer);
          reject(new Error("WebSocket is not connected"));
        }
      }, 50);
    });
  }

  private subscribeToService(serviceKey: string) {
    if (this.subscribedServices.has(serviceKey)) {
      return;
    }
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
    const rpcId = Long.fromString(String(Date.now() * 1_000_000));
    const frame = buildFrame(SocketMsgType.Subscribe, {
      service_id: sid,
      rpc_id: rpcId,
      chunk_index: 0,
    });
    this.ws?.send(frame);
    this.subscribedServices.add(serviceKey);
  }

  close() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.subscribedServices.clear();
    this.onAppEventCb = null;
    this.onCommandNodeEventCb = null;
    for (const pending of this.rpcPendings.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("WebSocket closed"));
    }
    this.rpcPendings.clear();
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
      return true;
    }

    const chunkIndex = Number(
      (hdr as { chunk_index?: number }).chunk_index ?? 0,
    );
    if (type === SocketMsgType.Event) {
      if (chunkIndex > 0) {
        this.eventChunkPendings.set(headerRpcIdToString(hdr.rpc_id), {
          headerData: dataStr,
          serviceId: hdr.service_id,
          numChunks: chunkIndex,
          chunks: new Map(),
        });
        return false;
      }
      this.dispatchDecodedEvent(dataStr, rest, hdr.service_id);
      return false;
    }

    if (type === SocketMsgType.EventChunk) {
      const pendingId = decodeProtobufUintToString(hdr.rpc_id);
      const pending = this.eventChunkPendings.get(pendingId);
      if (!pending) {
        console.warn(`Chunked Event ${pendingId} not found; drop chunk`);
        return false;
      }
      pending.chunks.set(decodeProtobufUintToNumber(hdr.chunk_index), rest);
      if (pending.chunks.size === pending.numChunks) {
        this.eventChunkPendings.delete(pendingId);
        const chunks: Uint8Array[] = [];
        for (let i = 0; i < pending.numChunks; i++) {
          const part = pending.chunks.get(i);
          if (!part) {
            console.warn(`Chunked Event ${pendingId} missing chunk ${i}`);
            return false;
          }
          chunks.push(part);
        }
        this.dispatchDecodedEvent(
          pending.headerData,
          concatUint8Arrays(chunks),
          pending.serviceId,
        );
      }
      return false;
    }

    if (type === SocketMsgType.RPC) {
      const pendingId = headerRpcIdToString(hdr.rpc_id);
      const pending = this.rpcPendings.get(pendingId);
      if (!pending) {
        console.warn(`RPC ${pendingId} not found; drop reply`);
        return false;
      }
      if (chunkIndex > 0) {
        pending.headerData = dataStr;
        pending.numChunks = chunkIndex;
        pending.serviceId = hdr.service_id;
        return false;
      }
      this.resolveRpcPending(pendingId, pending, dataStr, rest);
      return false;
    }

    if (type === SocketMsgType.Chunk) {
      const pendingId = decodeProtobufUintToString(hdr.rpc_id);
      const pending = this.rpcPendings.get(pendingId);
      if (!pending) {
        console.warn(`RPC ${pendingId} not found; drop chunk`);
        return false;
      }
      pending.chunks.set(decodeProtobufUintToNumber(hdr.chunk_index), rest);
      if (pending.chunks.size === pending.numChunks) {
        const chunks: Uint8Array[] = [];
        for (let i = 0; i < pending.numChunks; i++) {
          const part = pending.chunks.get(i);
          if (!part) {
            console.warn(`RPC ${pendingId} missing chunk ${i}`);
            return false;
          }
          chunks.push(part);
        }
        this.resolveRpcPending(
          pendingId,
          pending,
          pending.headerData,
          concatUint8Arrays(chunks),
        );
      }
      return false;
    }

    if (type === SocketMsgType.RPCError || type === SocketMsgType.UserError) {
      const pendingId = headerRpcIdToString(hdr.rpc_id);
      const pending = this.rpcPendings.get(pendingId);
      if (pending) {
        clearTimeout(pending.timer);
        this.rpcPendings.delete(pendingId);
        pending.reject(new Error(formatSocketError(dataStr)));
      }
      return false;
    }

    if (type & 0xf0) {
      console.warn("tensorpc socket error frame", type, dataStr);
    }
    return false;
  }

  private resolveRpcPending(
    pendingId: string,
    pending: PendingRpc,
    dataStr: string,
    binary: Uint8Array,
  ) {
    try {
      const decoded = decodeTensorPcPayload(dataStr, binary);
      clearTimeout(pending.timer);
      this.rpcPendings.delete(pendingId);
      pending.resolve(unwrapRpcResult(decoded));
    } catch (err) {
      clearTimeout(pending.timer);
      this.rpcPendings.delete(pendingId);
      pending.reject(err);
    }
  }

  private dispatchDecodedEvent(
    dataStr: string,
    binary: Uint8Array,
    serviceId: number,
  ) {
    const decoded = decodeTensorPcPayload(dataStr, binary);
    const payload = decoded as unknown[];
    const isAppEvent = serviceId === this.serviceMap[FLOW_APP_EVENT];
    const isCommandNodeEvent = serviceId === this.serviceMap[FLOW_COMMAND_NODE_EVENT];

    if (isAppEvent) {
      const appEv = findAppEventPayload(payload) as AppEventMessage;
      if (!appEv || !Array.isArray(appEv.typeToEvents)) {
        console.warn("App event payload is unexpected:", payload);
        return;
      }
      this.onAppEventCb?.(appEv);
      return;
    }

    if (isCommandNodeEvent) {
      const commandPayload = findCommandEventPayload(payload);
      if (!commandPayload) {
        console.warn("Command event payload is unexpected:", payload);
        return;
      }
      this.onCommandNodeEventCb?.({
        uid: commandPayload.uid,
        data: commandPayload,
      });
      return;
    }

    console.warn("Event received for unknown service:", serviceId, payload);
  }
}

function createClientId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function withFreshClientId(wsUrl: string): string {
  try {
    const u = new URL(wsUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const clientId = createClientId();
    if (parts.length >= 2 && parts.at(-2) === "ws") {
      parts[parts.length - 1] = clientId;
    } else {
      parts.push(clientId);
    }
    u.pathname = `/${parts.join("/")}`;
    return u.toString();
  } catch {
    return wsUrl;
  }
}

function decodeTensorPcPayload(dataStr: string, binary: Uint8Array) {
  const { meta, skeleton } = parseSkeletonData(dataStr);
  const arrays = extractArraysFromBinary(meta, binary);
  return putArraysToData(arrays as ArrayBufferView[], skeleton);
}

function unwrapRpcResult(decoded: unknown) {
  if (Array.isArray(decoded)) {
    const args = decoded[0];
    if (Array.isArray(args)) return args[0] ?? null;
    return args ?? null;
  }
  return decoded;
}

function formatSocketError(dataStr: string) {
  try {
    const parsed = JSON.parse(dataStr) as { error?: unknown; detail?: unknown };
    const error = typeof parsed.error === "string" ? parsed.error : "RPC error";
    const detail = typeof parsed.detail === "string" ? parsed.detail : "";
    const lastLine = detail
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .pop();
    return lastLine ? `${error}: ${lastLine}` : error;
  } catch {
    return dataStr || "RPC error";
  }
}

function headerRpcIdToString(value: unknown) {
  if (Long.isLong(value)) return value.toString();
  return String(value ?? 0);
}

function decodeProtobufUintToString(value: unknown) {
  const longValue = Long.isLong(value)
    ? value
    : Long.fromValue(value as Long | number | string);
  return longValue.sub(1).toString();
}

function decodeProtobufUintToNumber(value: unknown) {
  return Number(decodeProtobufUintToString(value));
}

function concatUint8Arrays(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function findAppEventPayload(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.typeToEvents)) return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAppEventPayload(item);
      if (found) return found;
    }
  }
  return null;
}

function findCommandEventPayload(value: unknown): { uid: string } | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.uid === "string" && typeof record.type === "string") {
      return record as { uid: string };
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCommandEventPayload(item);
      if (found) return found;
    }
  }
  return null;
}

export { buildFrame, EMPTY_SKELETON, FLOW_APP_EVENT };
