import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { normalizeTerminalText, renderAnsiText, sanitizeTerminalContent } from "./terminalText";

function applyTerminalEvent(current: string, data: unknown) {
  if (!Array.isArray(data)) return current;
  const [kind, payload] = data;
  const text = normalizeTerminalText(payload);
  if (kind === 2) return text;
  if (kind === 0) return sanitizeTerminalContent(current + text);
  if (kind === 1) return current + "\n[process exited]\n";
  return current;
}

export function Terminal({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const initialLines = Array.isArray(props.lines) ? (props.lines as string[]) : [];
  const [content, setContent] = useState(normalizeTerminalText(initialLines.join("\n")));
  const preRef = useRef<HTMLPreElement>(null);
  const uid = typeof props.compUid === "string" ? props.compUid : "";
  const useStartupTerminal = props.useStartupTerminal === true;

  useEffect(() => {
    if (!uid) return;
    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent<{ uid?: string; data?: unknown }>;
      if (custom.detail?.uid !== uid) return;
      setContent((current) => applyTerminalEvent(current, custom.detail.data));
    };
    window.addEventListener("tensorpc-component-event", handleEvent);
    return () => window.removeEventListener("tensorpc-component-event", handleEvent);
  }, [uid]);

  useEffect(() => {
    if (!useStartupTerminal) return;
    const cached = (window as unknown as { __tensorpcStartupTerminalContent?: string })
      .__tensorpcStartupTerminalContent;
    if (cached) setContent(normalizeTerminalText(cached));
    const handleStartupTerminal = (event: Event) => {
      const custom = event as CustomEvent<{ content?: unknown }>;
      const next = normalizeTerminalText(custom.detail?.content);
      setContent(next);
    };
    window.addEventListener("tensorpc-startup-terminal-content", handleStartupTerminal);
    return () =>
      window.removeEventListener("tensorpc-startup-terminal-content", handleStartupTerminal);
  }, [useStartupTerminal]);

  useEffect(() => {
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [content]);

  return (
    <div
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height: sx.height ?? "100%",
        minHeight: sx.minHeight ?? 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--td-terminal-bg)",
        color: "var(--td-text)",
        overflow: "hidden",
        border: "1px solid var(--td-border)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 13,
      }}
    >
      <pre
        ref={preRef}
        style={{
          margin: 0,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "4px 8px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: "18px",
        }}
      >
        {renderAnsiText(content)}
      </pre>
    </div>
  );
}
