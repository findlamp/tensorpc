import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppEventType } from "../core/socketTypes";
import { TensorPcWs, type AppEventMessage } from "../core/tensorPcWs";

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
  callSocketRpc: (serviceKey: string, args: unknown[], timeoutMs?: number) => Promise<unknown>;
  appRuntimeTargetVersion: number;
  setAppRuntimeTarget: (
    target: { graphId: string; nodeId: string; rpcUrl: string } | null,
  ) => void;
  sendUiEvent: (
    graphId: string,
    nodeId: string,
    compUid: string,
    eventType: number,
    data: unknown,
    indexesRaw?: string,
    timeoutMs?: number,
    isSync?: boolean,
  ) => Promise<boolean>;
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
  callSocketRpc: async () => null,
  appRuntimeTargetVersion: 0,
  setAppRuntimeTarget: () => {},
  sendUiEvent: async () => false,
});

const WS_URL_STORAGE_KEY = "tensorpc-devdock-ws-url";

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

function deriveHttpUrl(wsUrl: string): string {
  try {
    const u = new URL(wsUrl);
    return `${u.protocol === "wss:" ? "https:" : "http:"}//${u.host}`;
  } catch {
    return "http://127.0.0.1:51052";
  }
}

const RUN_SINGLE_EVENT_KEY = "tensorpc.dock.serv.core::Flow.run_single_event";

declare global {
  interface Window {
    __tensorpcDevflowWs?: TensorPcWs;
  }
}

export function TensorPcProvider({ children }: { children: ReactNode }) {
  const [url, setUrlState] = useState(() => {
    const savedUrl = localStorage.getItem(WS_URL_STORAGE_KEY);
    if (savedUrl) return withFreshClientId(savedUrl);
    const envHost = import.meta.env.VITE_DEFAULT_WS_HOST;
    const envPort = import.meta.env.VITE_DEFAULT_WS_PORT;
    const envPath = import.meta.env.VITE_DEFAULT_WS_PATH;
    const host = envHost || "127.0.0.1";
    const port = envPort || "51052";
    const path = envPath || "/api/ws";
    return `ws://${host}:${port}${path}/${createClientId()}`;
  });
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [appRuntimeTargetVersion, setAppRuntimeTargetVersion] = useState(0);
  const clientRef = useRef<TensorPcWs | null>(null);
  const connectGenerationRef = useRef(0);
  const connectingRef = useRef<Promise<void> | null>(null);
  const handlerRef = useRef<((ev: AppEventMessage) => void) | null>(null);
  const commandHandlerRef = useRef<((ev: CommandNodeEventMessage) => void) | null>(null);
  const appRuntimeTargetRef = useRef<{
    graphId: string;
    nodeId: string;
    rpcUrl: string;
  } | null>(null);

  const httpBaseUrl = deriveHttpUrl(url);

  const setUrl = useCallback((nextUrl: string) => {
    const trimmedUrl = nextUrl.trim();
    if (!trimmedUrl) return;
    const freshUrl = withFreshClientId(trimmedUrl);
    localStorage.setItem(WS_URL_STORAGE_KEY, freshUrl);
    setUrlState(freshUrl);
  }, []);

  const disconnect = useCallback(() => {
    const current = clientRef.current;
    connectGenerationRef.current += 1;
    current?.close();
    if (window.__tensorpcDevflowWs === current) {
      window.__tensorpcDevflowWs = undefined;
    }
    clientRef.current = null;
    connectingRef.current = null;
    handlerRef.current = null;
    commandHandlerRef.current = null;
    setStatus("idle");
    setReconnectAttempt(0);
  }, []);

  const connect = useCallback(async () => {
    const generation = connectGenerationRef.current + 1;
    connectGenerationRef.current = generation;
    setStatus("connecting");
    setError(null);
    setReconnectAttempt(0);

    const previous = clientRef.current;
    if (previous) {
      previous.close();
      if (window.__tensorpcDevflowWs === previous) {
        window.__tensorpcDevflowWs = undefined;
      }
    }

    const connectUrl = withFreshClientId(url);
    const client = new TensorPcWs(connectUrl, {
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
    if (window.__tensorpcDevflowWs && window.__tensorpcDevflowWs !== client) {
      window.__tensorpcDevflowWs.close();
    }
    window.__tensorpcDevflowWs = client;
    clientRef.current = client;

    const pending = client.connect();
    connectingRef.current = pending;
    try {
      await pending;
      if (connectGenerationRef.current !== generation || clientRef.current !== client) {
        return;
      }
      if (handlerRef.current) {
        client.subscribeToAppEvents(handlerRef.current);
      }
      if (commandHandlerRef.current) {
        client.subscribeToCommandNodeEvents(commandHandlerRef.current);
      }
      setStatus("connected");
    } catch (e) {
      if (connectGenerationRef.current !== generation || clientRef.current !== client) {
        return;
      }
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
      if (window.__tensorpcDevflowWs === client) {
        window.__tensorpcDevflowWs = undefined;
      }
      clientRef.current = null;
    } finally {
      if (connectGenerationRef.current === generation && clientRef.current === client) {
        connectingRef.current = null;
      }
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

  const callSocketRpc = useCallback(
    async (serviceKey: string, args: unknown[], timeoutMs?: number) => {
      if (!clientRef.current && connectingRef.current) {
        await connectingRef.current;
      }
      const client = clientRef.current;
      if (!client) throw new Error("WebSocket is not connected");
      return client.call(serviceKey, args, timeoutMs);
    },
    [],
  );

  const setAppRuntimeTarget = useCallback(
    (target: { graphId: string; nodeId: string; rpcUrl: string } | null) => {
      const currentTarget = appRuntimeTargetRef.current;
      const currentKey = currentTarget
        ? `${currentTarget.graphId}@${currentTarget.nodeId}:${currentTarget.rpcUrl}`
        : "";
      const nextKey = target ? `${target.graphId}@${target.nodeId}:${target.rpcUrl}` : "";
      appRuntimeTargetRef.current = target;
      if (currentKey !== nextKey) {
        setAppRuntimeTargetVersion((version) => version + 1);
      }
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
      indexesRaw?: string,
      timeoutMs?: number,
      isSync = false,
    ) => {
      const uiEvDict = {
        [compUid]:
          indexesRaw === undefined ? [eventType, data] : [eventType, data, indexesRaw],
      };
      const args = [graphId, nodeId, AppEventType.UIEvent, uiEvDict, true, isSync];
      try {
        await callSocketRpc(RUN_SINGLE_EVENT_KEY, args, timeoutMs ?? 30_000);
        return true;
      } catch (e) {
        console.warn("sendUiEvent RPC error:", e);
        return false;
      }
    },
    [callSocketRpc],
  );

  useEffect(() => {
    void connect();
    return () => disconnect();
  }, [connect, disconnect]);

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
        callSocketRpc,
        appRuntimeTargetVersion,
        sendUiEvent,
        setAppRuntimeTarget,
      }}
    >
      {children}
    </TensorPcContext.Provider>
  );
}
