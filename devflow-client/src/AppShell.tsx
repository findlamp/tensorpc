import { useCallback, useContext, useState } from "react";
import { TensorPcContext } from "./context/TensorPcContext";
import { LayoutContext } from "./context/LayoutContext";
import { LayoutRoot, extractUpdateLayout } from "./components/LayoutRoot";
import type { AppEventMessage } from "./core/tensorPcWs";

function parseNodeUid(uid: string): { graphId: string; nodeId: string } | null {
  const parts = uid.split("@");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { graphId: parts[0]!, nodeId: parts[1]! };
  }
  return null;
}

export function AppShell() {
  const {
    url,
    setUrl,
    status,
    error,
    reconnectAttempt,
    connect,
    disconnect,
    subscribeToAppEvents,
  } = useContext(TensorPcContext);
  const { layout, setLayout, setGraphContext } = useContext(LayoutContext);
  const [rawLog, setRawLog] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);

  const handleConnect = useCallback(async () => {
    try {
      await connect();
      subscribeToAppEvents((ev: AppEventMessage) => {
        setEventCount((c) => c + 1);
        const lay = extractUpdateLayout(ev);
        if (lay) {
          setLayout(lay);
          const ctx = parseNodeUid(ev.uid);
          if (ctx) {
            setGraphContext(ctx.graphId, ctx.nodeId);
          }
        }
        // Always log latest event for debugging
        setRawLog(
          JSON.stringify(
            {
              uid: ev.uid,
              eventCount: ev.typeToEvents?.length ?? 0,
              types: ev.typeToEvents?.map(([t]) => t) ?? [],
              hasLayout: !!lay,
            },
            null,
            2,
          ),
        );
      });
    } catch {
      // error handled by context
    }
  }, [connect, subscribeToAppEvents, setLayout, setGraphContext]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setLayout(null);
    setRawLog(null);
    setEventCount(0);
  }, [disconnect, setLayout]);

  const statusText =
    status === "reconnecting"
      ? `Reconnecting (${reconnectAttempt}/10)`
      : status;
  const statusColor =
    status === "connected"
      ? "#4caf50"
      : status === "reconnecting"
        ? "#ff9800"
        : status === "error"
          ? "#f44336"
          : status === "connecting"
            ? "#ff9800"
            : "#666";

  const header = (
    <header
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: "1px solid #333",
        flexShrink: 0,
        backgroundColor: "#1e1e1e",
      }}
    >
      <label style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ whiteSpace: "nowrap", color: "#aaa", fontSize: 13 }}>WS</span>
        <input
          style={{
            flex: 1,
            fontFamily: "monospace",
            fontSize: 12,
            padding: "4px 8px",
            border: "1px solid #444",
            borderRadius: 4,
            backgroundColor: "#2a2a2a",
            color: "#ddd",
          }}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
        />
      </label>
      <button
        type="button"
        onClick={handleConnect}
        disabled={status === "connecting" || status === "reconnecting"}
        style={{
          padding: "4px 16px",
          border: "none",
          borderRadius: 4,
          backgroundColor:
            status === "connecting" || status === "reconnecting" ? "#444" : "#1976d2",
          color: "#fff",
          cursor:
            status === "connecting" || status === "reconnecting" ? "not-allowed" : "pointer",
          fontSize: 13,
        }}
      >
        {status === "connecting"
          ? "Connecting…"
          : status === "reconnecting"
            ? "Reconnecting…"
            : "Connect"}
      </button>
      {status === "connected" && (
        <button
          type="button"
          onClick={handleDisconnect}
          style={{
            padding: "4px 12px",
            border: "1px solid #f44336",
            borderRadius: 4,
            backgroundColor: "transparent",
            color: "#f44336",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Disconnect
        </button>
      )}
      <span
        style={{
          fontSize: 12,
          color: statusColor,
          fontWeight: 600,
          minWidth: 100,
          textAlign: "right",
        }}
      >
        {statusText}
      </span>
      {eventCount > 0 && (
        <span style={{ fontSize: 11, color: "#888" }}>
          {eventCount} events
        </span>
      )}
    </header>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {header}
      {error ? (
        <div
          style={{
            padding: "8px 12px",
            color: "#f44336",
            backgroundColor: "#2a0000",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        {layout ? (
          <LayoutRoot layout={layout} />
        ) : status === "connected" ? (
          <div style={{ padding: 24, color: "#888", textAlign: "center" }}>
            <p style={{ fontSize: 16, marginBottom: 8, color: "#4caf50" }}>
              Connected — waiting for UpdateLayout event
            </p>
            <p style={{ fontSize: 13 }}>
              Make sure an app node is running and publishing layouts.
            </p>
            {eventCount > 0 && (
              <p style={{ fontSize: 12, color: "#ff9800", marginTop: 8 }}>
                Received {eventCount} event(s) but no UpdateLayout yet.
                <br />
                Check "Last event" below to see what's coming through.
              </p>
            )}
          </div>
        ) : (
          <div style={{ padding: 24, color: "#888", textAlign: "center" }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>
              Connect to a tensorpc server to start
            </p>
            <p style={{ fontSize: 13 }}>
              After connecting, the first <code>UpdateLayout</code> app event
              will render here.
            </p>
          </div>
        )}
      </div>
      {rawLog && (status === "connected" || status === "reconnecting") ? (
        <details
          style={{
            borderTop: "1px solid #333",
            fontSize: 11,
            backgroundColor: "#1e1e1e",
          }}
          open
        >
          <summary
            style={{
              padding: "6px 12px",
              cursor: "pointer",
              color: "#aaa",
            }}
          >
            Last event (received {eventCount} total)
          </summary>
          <pre
            style={{
              margin: 0,
              maxHeight: 200,
              overflow: "auto",
              background: "#2a2a2a",
              color: "#ccc",
              padding: "8px 12px",
              fontSize: 11,
            }}
          >
            {rawLog}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
