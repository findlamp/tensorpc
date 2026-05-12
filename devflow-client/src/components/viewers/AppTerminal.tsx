import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent,
} from "react";
import { LayoutContext } from "../../context/LayoutContext";
import { normalizeTerminalText, renderAnsiText } from "./terminalText";

function terminalBufferKey(graphId: string | null | undefined, nodeId: string | null | undefined) {
  return graphId && nodeId ? `${graphId}@${nodeId}` : "";
}

export function AppTerminal({
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const { graphId, nodeId } = useContext(LayoutContext);
  const terminalKey = terminalBufferKey(graphId, nodeId);
  const [content, setContent] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const appTerminalSeenRef = useRef(false);

  useEffect(() => {
    appTerminalSeenRef.current = false;
    const globalWindow = window as unknown as {
      __tensorpcAppTerminalContent?: string;
      __tensorpcAppTerminalContentByKey?: Record<string, string>;
    };
    const appTerminalContent = terminalKey
      ? globalWindow.__tensorpcAppTerminalContentByKey?.[terminalKey]
      : globalWindow.__tensorpcAppTerminalContent;
    const cached = terminalKey
      ? ""
      : (window as unknown as { __tensorpcStartupTerminalContent?: string })
          .__tensorpcStartupTerminalContent;
    if (appTerminalContent !== undefined) {
      appTerminalSeenRef.current = true;
      setContent(normalizeTerminalText(appTerminalContent));
    } else if (cached) {
      setContent(normalizeTerminalText(cached));
    } else {
      setContent("");
    }

    const handleAppTerminal = (event: Event) => {
      const custom = event as CustomEvent<{ key?: string; content?: unknown }>;
      if (terminalKey) {
        if (custom.detail?.key !== terminalKey) return;
      } else if (custom.detail?.key) {
        return;
      }
      appTerminalSeenRef.current = true;
      setContent(normalizeTerminalText(custom.detail?.content));
    };

    const handleStartupTerminal = (event: Event) => {
      if (terminalKey) return;
      const custom = event as CustomEvent<{ content?: unknown }>;
      const next = normalizeTerminalText(custom.detail?.content);
      if (!appTerminalSeenRef.current && next) setContent(next);
    };
    window.addEventListener("tensorpc-app-terminal-content", handleAppTerminal);
    window.addEventListener("tensorpc-startup-terminal-content", handleStartupTerminal);
    return () => {
      window.removeEventListener("tensorpc-app-terminal-content", handleAppTerminal);
      window.removeEventListener("tensorpc-startup-terminal-content", handleStartupTerminal);
    };
  }, [terminalKey]);

  useLayoutEffect(() => {
    const output = outputRef.current;
    if (!output || !stickToBottomRef.current) return;
    requestAnimationFrame(() => {
      output.scrollTop = output.scrollHeight;
    });
  }, [content]);

  const syncStickToBottom = () => {
    const output = outputRef.current;
    if (!output) return;
    stickToBottomRef.current =
      output.scrollHeight - output.scrollTop - output.clientHeight < 24;
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const output = outputRef.current;
    if (!output || output.scrollHeight <= output.clientHeight) return;
    const multiplier =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? output.clientHeight : 1;
    const before = output.scrollTop;
    output.scrollTop += event.deltaY * multiplier;
    if (output.scrollTop !== before) {
      event.preventDefault();
      event.stopPropagation();
      syncStickToBottom();
    }
  };

  const normalizedContent = useMemo(() => normalizeTerminalText(content), [content]);

  return (
    <div
      role="log"
      aria-label="app terminal output"
      data-tensorpc-app-terminal=""
      style={{
        width: "100%",
        height: "100%",
        maxHeight: "100%",
        flex: "1 1 0%",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        overscrollBehavior: "contain",
        background: "var(--td-terminal-bg)",
        borderTop: "1px solid var(--td-border)",
        boxSizing: "border-box",
        color: "var(--td-text)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      <div
        style={{
          minHeight: 28,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 10px",
          background: "var(--td-terminal-header)",
          borderBottom: "1px solid var(--td-border)",
          color: "var(--td-text-muted)",
          fontSize: 12,
          fontFamily: "Inter, system-ui, sans-serif",
          flexShrink: 0,
        }}
      >
        <span>Terminal</span>
        <span style={{ color: "var(--td-green)" }}>● connected</span>
      </div>
      <div
        ref={outputRef}
        onScroll={syncStickToBottom}
        onWheel={handleWheel}
        style={{
          flex: "1 1 0%",
          height: 0,
          minWidth: 0,
          minHeight: 0,
          maxHeight: "100%",
          overflowX: "hidden",
          overflowY: "scroll",
          overscrollBehavior: "contain",
          scrollbarGutter: "stable",
          scrollbarColor: "var(--td-text-muted) transparent",
          boxSizing: "border-box",
        }}
      >
        <pre
          style={{
            margin: 0,
            minHeight: "100%",
            maxWidth: "100%",
            padding: "8px 10px",
            fontSize: 13,
            lineHeight: "18px",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            boxSizing: "border-box",
          }}
        >
          {renderAnsiText(normalizedContent)}
        </pre>
      </div>
    </div>
  );
}
