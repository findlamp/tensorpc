import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeTerminalText, renderAnsiText } from "./terminalText";

export function AppTerminal({
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const [content, setContent] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = (window as unknown as { __tensorpcStartupTerminalContent?: string })
      .__tensorpcStartupTerminalContent;
    if (cached) setContent(normalizeTerminalText(cached));

    const handleStartupTerminal = (event: Event) => {
      const custom = event as CustomEvent<{ content?: unknown }>;
      setContent(normalizeTerminalText(custom.detail?.content));
    };
    window.addEventListener("tensorpc-startup-terminal-content", handleStartupTerminal);
    return () =>
      window.removeEventListener("tensorpc-startup-terminal-content", handleStartupTerminal);
  }, []);

  useEffect(() => {
    const output = outputRef.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [content]);

  const normalizedContent = useMemo(
    () => content.replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
    [content],
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
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
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: "auto",
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
      </div>
    </div>
  );
}
