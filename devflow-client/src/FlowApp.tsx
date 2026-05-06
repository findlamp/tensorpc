import { useCallback, useContext, useMemo, useState, type CSSProperties } from "react";
import { TensorPcContext } from "./context/TensorPcContext";
import { FlowEditor } from "./flow/FlowEditor";

type ThemeMode = "dark" | "light";

export function FlowApp() {
  const { url } = useContext(TensorPcContext);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("tensorpc-devdock-theme");
    return saved === "light" ? "light" : "dark";
  });
  const isDark = themeMode === "dark";

  const handleThemeToggle = useCallback(() => {
    setThemeMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("tensorpc-devdock-theme", next);
      return next;
    });
  }, []);

  const themeVars = useMemo<CSSProperties>(
    () =>
      ({
        "--td-bg": isDark ? "#090d14" : "#ffffff",
        "--td-surface": isDark ? "#0f141d" : "#ffffff",
        "--td-surface-2": isDark ? "#151b25" : "#fafafa",
        "--td-surface-3": isDark ? "#1b2330" : "#f3f4f6",
        "--td-border": isDark ? "#283241" : "#dfe5ee",
        "--td-border-soft": isDark ? "#202936" : "#eceff4",
        "--td-text": isDark ? "#d8dee9" : "#242833",
        "--td-text-strong": isDark ? "#f4f7fb" : "#222222",
        "--td-text-muted": isDark ? "#8d98a8" : "#6f7782",
        "--td-active": isDark ? "#1e2a3a" : "#eaf1fb",
        "--td-sidebar-bg": isDark ? "#101720" : "#e8f5f9",
        "--td-sidebar-active": isDark ? "#263342" : "#d5e8ef",
        "--td-sidebar-hover": isDark ? "#1a2431" : "#dceef4",
        "--td-blue": isDark ? "#66a3ff" : "#4d73ff",
        "--td-green": isDark ? "#73c46b" : "#3f823c",
        "--td-terminal-bg": isDark ? "#080b10" : "#f3f4f6",
        "--td-terminal-header": isDark ? "#121822" : "#e6e8eb",
        "--td-flow-bg": isDark ? "#070d14" : "#f6f8fb",
        "--td-flow-dot": isDark ? "rgba(92, 112, 138, 0.46)" : "rgba(150, 164, 184, 0.52)",
        "--td-minimap-mask": isDark ? "rgba(9, 13, 20, 0.62)" : "rgba(245, 247, 251, 0.74)",
        "--td-node-bg": isDark ? "#121b27" : "#ffffff",
        "--td-node-header": isDark ? "#202b3a" : "#eef1f5",
        "--td-node-text": isDark ? "#e8edf5" : "#242833",
        "--td-input-bg": isDark ? "#0b111a" : "#ffffff",
        "--td-input-border": isDark ? "#344154" : "#cfd5df",
        "--td-shadow": isDark ? "rgba(0, 0, 0, 0.38)" : "rgba(21, 30, 48, 0.10)",
      }) as CSSProperties,
    [isDark],
  );

  return (
    <div
      className={isDark ? "tensorpc-dark" : "tensorpc-light"}
      style={{
        ...themeVars,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--td-bg)",
        color: "var(--td-text)",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <FlowEditor
          sidebarVisible={sidebarVisible}
          themeMode={themeMode}
          connectionUrl={url}
          onThemeToggle={handleThemeToggle}
          onToggleSidebar={() => setSidebarVisible((visible) => !visible)}
        />
      </div>
    </div>
  );
}
