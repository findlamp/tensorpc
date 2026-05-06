import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TensorPcWs, type AppEventMessage } from "../core/tensorPcWs";
import { encodeRpcRequest, decodeRpcReply } from "../core/rpcClient";
import { putArraysToData } from "../core/jsonCodec";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error" | "reconnecting";

export interface TensorPcContextValue {
  status: ConnectionStatus;
  error: string | null;
  reconnectAttempt: number;
  url: string;
  httpBaseUrl: string;
  setUrl: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribeToAppEvents: (handler: (ev: AppEventMessage) => void) => void;
  subscribeToCommandNodeEvents: (handler: (ev: CommandNodeEventMessage) => void) => void;
  sendUiEvent: (
    graphId: string,
    nodeId: string,
    compUid: string,
    eventType: number,
    data: unknown,
  ) => Promise<void>;
}

export type CommandNodeEventMessage = {
  uid: string;
  data: unknown;
};

export const TensorPcContext = createContext<TensorPcContextValue>({
  status: "idle",
  error: null,
  reconnectAttempt: 0,
  url: "ws://127.0.0.1:51052/api/ws/default",
  httpBaseUrl: "http://127.0.0.1:51052",
  setUrl: () => {},
  connect: async () => {},
  disconnect: () => {},
  subscribeToAppEvents: () => {},
  subscribeToCommandNodeEvents: () => {},
  sendUiEvent: async () => {},
});

const JSON_ARRAY_FLAG = 0x10;
const ENCODE_METHOD_MASK = 0xff;

function deriveHttpUrl(wsUrl: string): string {
  try {
    const u = new URL(wsUrl);
    return `${u.protocol === "wss:" ? "https:" : "http:"}//${u.host}`;
  } catch {
    return "http://127.0.0.1:51052";
  }
}

const RUN_UI_EVENT_KEY = "tensorpc.dock.serv.core::Flow.run_ui_event";

export function TensorPcProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState(() => {
    const envHost = import.meta.env.VITE_DEFAULT_WS_HOST;
    const envPort = import.meta.env.VITE_DEFAULT_WS_PORT;
    const envPath = import.meta.env.VITE_DEFAULT_WS_PATH;
    const host = envHost || "127.0.0.1";
    const port = envPort || "51052";
    const path = envPath || "/api/ws";
    const uid =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return `ws://${host}:${port}${path}/${uid}`;
  });
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const clientRef = useRef<TensorPcWs | null>(null);
  const handlerRef = useRef<((ev: AppEventMessage) => void) | null>(null);
  const commandHandlerRef = useRef<((ev: CommandNodeEventMessage) => void) | null>(null);

  const httpBaseUrl = deriveHttpUrl(url);

  const disconnect = useCallback(() => {
    clientRef.current?.close();
    clientRef.current = null;
    handlerRef.current = null;
    commandHandlerRef.current = null;
    setStatus("idle");
    setReconnectAttempt(0);
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    setReconnectAttempt(0);

    const client = new TensorPcWs(url, {
      maxReconnects: 10,
      reconnectBaseDelay: 1000,
      reconnectMaxDelay: 30000,
      onReconnecting: (attempt) => {
        setStatus("reconnecting");
        setReconnectAttempt(attempt);
        console.log(`WS reconnecting... attempt ${attempt}`);
      },
      onReconnectFailed: () => {
        setStatus("error");
        setError("Reconnection failed after max attempts");
      },
    });
    clientRef.current = client;

    try {
      await client.connect();
      setStatus("connected");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
      clientRef.current = null;
    }
  }, [url]);

  const subscribeToAppEvents = useCallback(
    (handler: (ev: AppEventMessage) => void) => {
      handlerRef.current = handler;
      clientRef.current?.subscribeToAppEvents(handler);
    },
    [],
  );

  const subscribeToCommandNodeEvents = useCallback(
    (handler: (ev: CommandNodeEventMessage) => void) => {
      commandHandlerRef.current = handler;
      clientRef.current?.subscribeToCommandNodeEvents(handler);
    },
    [],
  );

  const sendUiEvent = useCallback(
    async (
      graphId: string,
      nodeId: string,
      compUid: string,
      eventType: number,
      data: unknown,
    ) => {
      const uiEvDict = {
        [compUid]: [eventType, data],
      };
      const args = [graphId, nodeId, uiEvDict, false];
      const rpcReq = {
        service_key: RUN_UI_EVENT_KEY,
        data: JSON.stringify([args, {}]),
        flags: 0,
      };
      try {
        const body = encodeRpcRequest(rpcReq);
        const resp = await fetch(`/api/rpc`, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/octet-stream" },
        });
        if (!resp.ok) {
          console.warn(`sendUiEvent HTTP ${resp.status}`);
          return;
        }
        const respBuf = new Uint8Array(await resp.arrayBuffer());
        const reply = decodeRpcReply(respBuf);
        if (reply.exception) {
          console.warn(`sendUiEvent RPC error: ${reply.exception}`);
        } else if (reply.data) {
          const skeleton = JSON.parse(reply.data) as unknown;
          const arrays = (reply.arrays ?? []).map((array) => array.data);
          if (((reply.flags ?? 0) & ENCODE_METHOD_MASK) === JSON_ARRAY_FLAG) {
            putArraysToData(arrays, skeleton);
          }
        }
      } catch (e) {
        console.warn("sendUiEvent failed:", e);
      }
    },
    [httpBaseUrl],
  );

  useEffect(() => {
    void connect();
  }, [connect]);

  return (
    <TensorPcContext.Provider
      value={{
        status,
        error,
        reconnectAttempt,
        url,
        httpBaseUrl,
        setUrl,
        connect,
        disconnect,
        subscribeToAppEvents,
        subscribeToCommandNodeEvents,
        sendUiEvent,
      }}
    >
      {children}
    </TensorPcContext.Provider>
  );
}
