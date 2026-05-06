import { useEffect, useMemo, useRef, useState } from "react";

interface TerminalPanelProps {
  visible: boolean;
  onInput?: (data: string) => void;
  initialContent?: string;
  variant?: "dark" | "light";
  title?: string;
}

function stripAnsi(value: string) {
  return value.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    "",
  );
}

export function TerminalPanel({
  visible,
  initialContent,
  variant = "dark",
  title = "Terminal",
}: TerminalPanelProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    return () => {
      setReady(false);
    };
  }, [visible, variant]);

  useEffect(() => {
    if (!visible || !outputRef.current) return;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [initialContent, visible]);

  const normalizedContent = useMemo(() => {
    if (!initialContent) return "";
    return stripAnsi(initialContent).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }, [initialContent]);

  if (!visible) return null;

  const palette =
    variant === "light"
      ? {
          bg: "#f3f4f6",
          header: "#e6e8eb",
          headerText: "#4c4f55",
          border: "#cfd3da",
          text: "#23272d",
          accent: "#2e7d32",
          prompt: "#3b4048",
        }
      : {
          bg: "#0d0d0d",
          header: "#1a1a1a",
          headerText: "#888",
          border: "#333",
          text: "#c0c0c0",
          accent: "#5fbf65",
          prompt: "#e5e5e5",
        };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: palette.bg,
        color: palette.text,
        border: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          padding: "4px 10px",
          backgroundColor: palette.header,
          borderBottom: `1px solid ${palette.border}`,
          color: palette.headerText,
          fontSize: 11,
          display: "flex",
          gap: 12,
          alignItems: "center",
          minHeight: 24,
        }}
      >
        <span>{title}</span>
        <span style={{ color: ready ? palette.accent : "#777" }}>
          {ready ? "● connected" : "○ initializing"}
        </span>
      </div>
      <div
        ref={outputRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "8px 10px",
          fontFamily: "JetBrains Mono, Fira Code, Menlo, Monaco, Consolas, monospace",
          fontSize: 11,
          lineHeight: "16px",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {normalizedContent}
      </div>
    </div>
  );
}
