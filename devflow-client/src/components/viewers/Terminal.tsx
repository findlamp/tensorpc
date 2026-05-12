import { Terminal as XTerm, type IMarker } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LayoutContext } from "../../context/LayoutContext";
import { TensorPcContext } from "../../context/TensorPcContext";
import { FrontendEventType } from "../../core/socketTypes";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { normalizeLayoutUid } from "../../utils/layoutRefs";
import { dataToText, normalizeTerminalText, sanitizeTerminalContent } from "./terminalText";

type TerminalProps = {
  compUid?: unknown;
  terminalId?: unknown;
  lines?: unknown;
  initData?: unknown;
  useStartupTerminal?: unknown;
  theme?: unknown;
  fontFamily?: unknown;
  fontSize?: unknown;
  lineHeight?: unknown;
  scrollback?: unknown;
  cursorBlink?: unknown;
  cursorStyle?: unknown;
  disableStdin?: unknown;
  tabStopWidth?: unknown;
  allowTransparency?: unknown;
  convertEol?: unknown;
  sx?: unknown;
  flex?: unknown;
  grow?: unknown;
  shrink?: unknown;
  basis?: unknown;
  width?: unknown;
  height?: unknown;
  minWidth?: unknown;
  minHeight?: unknown;
  maxWidth?: unknown;
  maxHeight?: unknown;
  overflow?: unknown;
};

function optionNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function optionBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function optionCursorStyle(value: unknown): "block" | "underline" | "bar" {
  if (value === "underline" || value === "bar" || value === "block") {
    return value;
  }
  return "block";
}

function cssVar(host: HTMLElement, name: string, fallback: string): string {
  const value = getComputedStyle(host).getPropertyValue(name).trim();
  return value || fallback;
}

function createTerminalOptions(props: TerminalProps, host: HTMLElement) {
  const explicitTheme = props.theme === "light" || props.theme === "dark" ? props.theme : undefined;
  const isLight = explicitTheme === "light" || (!explicitTheme && Boolean(host.closest(".tensorpc-light")));

  return {
    allowTransparency: optionBoolean(props.allowTransparency, true),
    convertEol: optionBoolean(props.convertEol, false),
    cursorBlink: optionBoolean(props.cursorBlink, true),
    cursorStyle: optionCursorStyle(props.cursorStyle),
    disableStdin: false,
    fontFamily:
      typeof props.fontFamily === "string"
        ? props.fontFamily
        : "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: optionNumber(props.fontSize, 13),
    lineHeight: optionNumber(props.lineHeight, 1),
    scrollback: optionNumber(props.scrollback, 10000),
    tabStopWidth: optionNumber(props.tabStopWidth, 8),
    theme: {
      background: cssVar(host, "--td-terminal-bg", isLight ? "#f3f4f6" : "#080b10"),
      foreground: cssVar(host, "--td-text", isLight ? "#242833" : "#d8dee9"),
      cursor: cssVar(host, "--td-blue", isLight ? "#4d73ff" : "#66a3ff"),
      cursorAccent: cssVar(host, "--td-terminal-bg", isLight ? "#f3f4f6" : "#080b10"),
      selectionBackground: isLight ? "#c8dcff" : "#294b76",
      black: "#000000",
      red: "#d32f2f",
      green: "#3f823c",
      yellow: "#b7791f",
      blue: "#1976d2",
      magenta: "#8e24aa",
      cyan: "#00838f",
      white: isLight ? "#f3f4f6" : "#d8dee9",
      brightBlack: "#6f7782",
      brightRed: "#ff6b6b",
      brightGreen: "#73c46b",
      brightYellow: "#f9a825",
      brightBlue: "#66a3ff",
      brightMagenta: "#ab47bc",
      brightCyan: "#00acc1",
      brightWhite: "#ffffff",
    },
  };
}

function terminalIdFromProps(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function Terminal({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const { graphId, nodeId } = useContext(LayoutContext);
  const { appRuntimeTargetVersion, sendUiEvent } = useContext(TensorPcContext);
  const sx = useFlexStyles(props);
  const uid = typeof props.compUid === "string" ? props.compUid : "";
  const normalizedUid = useMemo(() => normalizeLayoutUid(uid), [uid]);
  const runtimeKey = useMemo(
    () => `${graphId ?? ""}@${nodeId ?? ""}@${uid}`,
    [graphId, nodeId, uid],
  );
  const terminalId = terminalIdFromProps(props.terminalId);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const mountedTerminalIdRef = useRef("");
  const frontendMountedRef = useRef(false);
  const lastResizeRef = useRef("");
  const resizeTimerRef = useRef<number | null>(null);
  const pendingResizeRef = useRef<{ cols: number; rows: number } | null>(null);
  const pendingWritesRef = useRef<Array<{ data: unknown; clear: boolean; forceFollow: boolean }>>([]);
  const terminalEventSeenRef = useRef(false);
  const stickToBottomRef = useRef(true);
  const hasWrittenRef = useRef(false);
  const preservingFitRef = useRef(false);
  const preservingFitFrameRef = useRef(0);
  const preservingFitMarkerRef = useRef<IMarker | null>(null);
  const lastFitDimensionsRef = useRef("");
  const contextRef = useRef({ graphId, nodeId, uid, sendUiEvent });
  const [themeRevision, setThemeRevision] = useState(0);

  const propLinesContent = useMemo(() => {
    if (!Array.isArray(props.lines)) {
      return "";
    }
    return props.lines.map((line) => dataToText(line)).join("\n");
  }, [props.lines]);

  const useStartupTerminal =
    props.useStartupTerminal === true && !(graphId && nodeId && uid);

  useEffect(() => {
    contextRef.current = { graphId, nodeId, uid, sendUiEvent };
  }, [graphId, nodeId, uid, sendUiEvent]);

  const emitResize = useCallback((cols: number, rows: number) => {
    if (cols <= 0 || rows <= 0) {
      return;
    }
    if (!frontendMountedRef.current) {
      pendingResizeRef.current = { cols, rows };
      return;
    }
    const resizeKey = `${cols}x${rows}`;
    if (lastResizeRef.current === resizeKey) {
      return;
    }
    lastResizeRef.current = resizeKey;
    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current);
    }
    resizeTimerRef.current = window.setTimeout(() => {
      resizeTimerRef.current = null;
      const context = contextRef.current;
      if (!context.graphId || !context.nodeId || !context.uid) {
        return;
      }
      void context
        .sendUiEvent(
          context.graphId,
          context.nodeId,
          context.uid,
          FrontendEventType.TerminalResize,
          {
            width: cols,
            height: rows,
          },
          undefined,
          8_000,
        )
        .then((ok) => {
          if (!ok) {
            frontendMountedRef.current = false;
          }
        });
    }, 120);
  }, []);

  const sendTerminalInput = useCallback((data: string) => {
    const context = contextRef.current;
    if (!context.graphId || !context.nodeId || !context.uid) {
      return;
    }
    void context
      .sendUiEvent(
        context.graphId,
        context.nodeId,
        context.uid,
        FrontendEventType.TerminalInput,
        data,
        undefined,
        10_000,
      )
      .then((ok) => {
        if (!ok) {
          frontendMountedRef.current = false;
        }
      });
  }, []);

  const focusTerminal = useCallback(() => {
    rootRef.current?.focus({ preventScroll: true });
    termRef.current?.focus();
    hostRef.current
      ?.querySelector<HTMLTextAreaElement>("textarea.xterm-helper-textarea")
      ?.focus({ preventScroll: true });
  }, []);

  const syncStickToBottom = useCallback((term: XTerm | null) => {
    if (!term) {
      stickToBottomRef.current = true;
      return;
    }
    const buffer = term.buffer.active;
    stickToBottomRef.current = buffer.baseY - buffer.viewportY <= 1;
  }, []);

  const fitTerminalPreservingViewport = useCallback((term: XTerm, fit: FitAddon) => {
    const proposed = fit.proposeDimensions();
    if (!proposed) {
      return;
    }
    const fitKey = `${proposed.cols}x${proposed.rows}`;
    if (fitKey === lastFitDimensionsRef.current && proposed.cols === term.cols && proposed.rows === term.rows) {
      return;
    }
    const before = term.buffer.active;
    const beforeCols = term.cols;
    const beforeRows = term.rows;
    const beforeViewportY = before.viewportY;
    const cursorAbsoluteY = before.baseY + before.cursorY;
    const marker: IMarker | undefined =
      beforeViewportY >= 0 ? term.registerMarker(beforeViewportY - cursorAbsoluteY) : undefined;
    const beforeDistanceFromBottom = Math.max(0, before.baseY - before.viewportY);
    const wasAtBottom = stickToBottomRef.current || before.baseY - before.viewportY <= 1;
    preservingFitRef.current = true;
    if (preservingFitFrameRef.current) {
      cancelAnimationFrame(preservingFitFrameRef.current);
      preservingFitFrameRef.current = 0;
    }
    preservingFitMarkerRef.current?.dispose();
    const restoreScroll = () => {
      if (wasAtBottom) {
        term.scrollToBottom();
      } else if (term.cols !== beforeCols && marker && marker.line >= 0) {
        term.scrollToLine(marker.line);
      } else if (term.cols !== beforeCols && term.rows === beforeRows) {
        term.scrollToLine(Math.min(beforeViewportY, term.buffer.active.baseY));
      } else {
        const after = term.buffer.active;
        term.scrollToLine(Math.max(0, after.baseY - beforeDistanceFromBottom));
      }
    };
    preservingFitMarkerRef.current = marker ?? null;
    fit.fit();
    lastFitDimensionsRef.current = fitKey;
    restoreScroll();
    preservingFitFrameRef.current = requestAnimationFrame(() => {
      restoreScroll();
      preservingFitFrameRef.current = requestAnimationFrame(() => {
        restoreScroll();
        marker?.dispose();
        if (preservingFitMarkerRef.current === marker) {
          preservingFitMarkerRef.current = null;
        }
        preservingFitFrameRef.current = 0;
        preservingFitRef.current = false;
        stickToBottomRef.current = wasAtBottom;
      });
    });
  }, []);

  const writeTerminal = useCallback((data: unknown, clear = false, forceFollow = false) => {
    const rawText = dataToText(data);
    const text = clear ? normalizeTerminalText(rawText) : sanitizeTerminalContent(rawText);
    const term = termRef.current;
    if (!term) {
      pendingWritesRef.current.push({ data: text, clear, forceFollow });
      return;
    }
    const shouldFollow = forceFollow || !hasWrittenRef.current || stickToBottomRef.current;
    if (clear) {
      term.reset();
      term.clear();
    }
    if (text) {
      term.write(text, () => {
        hasWrittenRef.current = true;
        if (shouldFollow) {
          term.scrollToBottom();
          requestAnimationFrame(() => {
            if (termRef.current === term) {
              term.scrollToBottom();
              syncStickToBottom(term);
            }
          });
        }
        syncStickToBottom(term);
      });
    } else {
      hasWrittenRef.current = true;
      syncStickToBottom(term);
    }
  }, [syncStickToBottom]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !uid) {
      return;
    }
    pendingWritesRef.current = [];
    hasWrittenRef.current = false;
    stickToBottomRef.current = true;
    terminalEventSeenRef.current = false;
    host.textContent = "";
    const term = new XTerm(createTerminalOptions(props, host));
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    term.focus();
    termRef.current = term;
    fitRef.current = fit;

    const inputDisposable = term.onData(sendTerminalInput);
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      emitResize(cols, rows);
    });
    const scrollDisposable = term.onScroll(() => {
      if (preservingFitRef.current) {
        return;
      }
      syncStickToBottom(term);
    });

    let resizeRaf = 0;
    const fitTerminal = () => {
      if (resizeRaf) {
        cancelAnimationFrame(resizeRaf);
      }
      resizeRaf = requestAnimationFrame(() => {
        try {
          fitTerminalPreservingViewport(term, fit);
          emitResize(term.cols, term.rows);
        } catch (error) {
          console.warn("xterm fit failed:", error);
        }
      });
    };

    fitTerminal();
    const resizeObserver = new ResizeObserver(fitTerminal);
    resizeObserver.observe(host);
    window.addEventListener("resize", fitTerminal);

    const pending = pendingWritesRef.current.splice(0);
    pending.forEach((item) => writeTerminal(item.data, item.clear, item.forceFollow));

    return () => {
      if (resizeRaf) {
        cancelAnimationFrame(resizeRaf);
      }
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitTerminal);
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      if (preservingFitFrameRef.current) {
        cancelAnimationFrame(preservingFitFrameRef.current);
        preservingFitFrameRef.current = 0;
      }
      preservingFitMarkerRef.current?.dispose();
      preservingFitMarkerRef.current = null;
      preservingFitRef.current = false;
      inputDisposable.dispose();
      resizeDisposable.dispose();
      scrollDisposable.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [emitResize, fitTerminalPreservingViewport, runtimeKey, sendTerminalInput, uid, writeTerminal]);

  useEffect(() => {
    const term = termRef.current;
    const host = hostRef.current;
    if (!term || !host) {
      return;
    }
    const options = createTerminalOptions(props, host);
    term.options.allowTransparency = options.allowTransparency;
    term.options.convertEol = options.convertEol;
    term.options.cursorBlink = options.cursorBlink;
    term.options.cursorStyle = options.cursorStyle;
    term.options.disableStdin = false;
    term.options.fontFamily = options.fontFamily;
    term.options.fontSize = options.fontSize;
    term.options.lineHeight = options.lineHeight;
    term.options.scrollback = options.scrollback;
    term.options.tabStopWidth = options.tabStopWidth;
    term.options.theme = options.theme;
    requestAnimationFrame(() => {
      try {
        const fit = fitRef.current;
        if (fit) {
          fitTerminalPreservingViewport(term, fit);
          emitResize(term.cols, term.rows);
        }
      } catch (error) {
        console.warn("xterm refit failed:", error);
      }
    });
  }, [
    emitResize,
    fitTerminalPreservingViewport,
    props.allowTransparency,
    props.convertEol,
    props.cursorBlink,
    props.cursorStyle,
    props.disableStdin,
    props.fontFamily,
    props.fontSize,
    props.lineHeight,
    props.scrollback,
    props.tabStopWidth,
    props.theme,
    themeRevision,
  ]);

  useEffect(() => {
    const host = hostRef.current;
    const themeRoot = host?.closest(".tensorpc-dark, .tensorpc-light");
    if (!themeRoot) {
      return;
    }
    const observer = new MutationObserver(() => {
      setThemeRevision((revision) => revision + 1);
    });
    observer.observe(themeRoot, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, [runtimeKey, uid]);

  useEffect(() => {
    if (!uid) {
      return;
    }
    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent<{ uid?: string; data?: unknown }>;
      const eventUid = typeof custom.detail?.uid === "string" ? custom.detail.uid : "";
      const normalizedEventUid = normalizeLayoutUid(eventUid);
      const uidMatches =
        eventUid === uid ||
        eventUid === normalizedUid ||
        normalizedEventUid === uid ||
        normalizedEventUid === normalizedUid;
      if (!uidMatches || !Array.isArray(custom.detail?.data)) {
        return;
      }
      terminalEventSeenRef.current = true;
      const [kind, payload] = custom.detail.data as [unknown, unknown];
      if (kind === 2) {
        writeTerminal(payload, true);
      } else if (kind === 0) {
        writeTerminal(payload, false, true);
      } else if (kind === 1) {
        writeTerminal("\r\n[process exited]\r\n", false, true);
      }
    };
    window.addEventListener("tensorpc-component-event", handleEvent);
    return () => window.removeEventListener("tensorpc-component-event", handleEvent);
  }, [normalizedUid, uid, writeTerminal]);

  useEffect(() => {
    if (propLinesContent) {
      writeTerminal(propLinesContent, true);
    }
  }, [propLinesContent, writeTerminal]);

  useEffect(() => {
    if (props.initData !== undefined) {
      writeTerminal(props.initData, true);
    }
  }, [props.initData, writeTerminal]);

  useEffect(() => {
    if (!useStartupTerminal) {
      return;
    }
    const cached = (window as unknown as { __tensorpcStartupTerminalContent?: string })
      .__tensorpcStartupTerminalContent;
    if (cached && !terminalEventSeenRef.current) {
      writeTerminal(cached, true);
    }
    const handleStartup = (event: Event) => {
      const custom = event as CustomEvent<{ content?: string }>;
      if (!terminalEventSeenRef.current && typeof custom.detail?.content === "string") {
        writeTerminal(custom.detail.content, true);
      }
    };
    window.addEventListener("tensorpc-startup-terminal-content", handleStartup);
    return () => window.removeEventListener("tensorpc-startup-terminal-content", handleStartup);
  }, [useStartupTerminal, writeTerminal]);

  useEffect(() => {
    if (!graphId || !nodeId || !uid) {
      return;
    }
    mountedTerminalIdRef.current = terminalId;
    frontendMountedRef.current = false;
    terminalEventSeenRef.current = false;
    stickToBottomRef.current = true;
    let disposed = false;
    let retryTimer: number | null = null;
    const requestMount = (attempt = 0) => {
      void sendUiEvent(
        graphId,
        nodeId,
        uid,
        FrontendEventType.TerminalFrontendMount,
        terminalId,
        undefined,
        30_000,
        true,
      ).then((mounted) => {
        if (disposed) {
          return;
        }
        if (!mounted) {
          frontendMountedRef.current = false;
          if (attempt < 6) {
            retryTimer = window.setTimeout(() => requestMount(attempt + 1), 500);
          }
          return;
        }
        frontendMountedRef.current = true;
        const pendingResize = pendingResizeRef.current;
        pendingResizeRef.current = null;
        if (pendingResize) {
          emitResize(pendingResize.cols, pendingResize.rows);
        }
      });
    };
    requestMount();
    return () => {
      disposed = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      if (frontendMountedRef.current) {
        void sendUiEvent(graphId, nodeId, uid, FrontendEventType.TerminalFrontendUnmount, {
          terminalId: mountedTerminalIdRef.current,
          state: "",
          ts: Date.now(),
        }, undefined, 8_000);
      }
      frontendMountedRef.current = false;
      mountedTerminalIdRef.current = "";
    };
  }, [
    appRuntimeTargetVersion,
    emitResize,
    graphId,
    nodeId,
    sendUiEvent,
    terminalId,
    uid,
  ]);

  return (
    <div
      ref={rootRef}
      role="terminal"
      aria-label="terminal"
      tabIndex={0}
      onPointerDownCapture={focusTerminal}
      onClick={focusTerminal}
      onWheel={(event) => event.stopPropagation()}
      data-tensorpc-terminal=""
      data-tensorpc-comp-uid={uid}
      data-tensorpc-normalized-comp-uid={normalizedUid}
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height: sx.height ?? "100%",
        maxHeight: sx.maxHeight ?? "100%",
        minWidth: sx.minWidth ?? 0,
        minHeight: sx.minHeight ?? 0,
        flex: sx.flex ?? "1 1 0%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        overscrollBehavior: "contain",
        backgroundColor: "var(--td-terminal-bg)",
        color: "var(--td-text)",
        border: "1px solid var(--td-border)",
      }}
    >
      <div
        ref={hostRef}
        className="tensorpc-xterm-host"
        style={{
          flex: "1 1 0%",
          minWidth: 0,
          minHeight: 0,
          width: "100%",
          height: "100%",
          maxHeight: "100%",
          overflow: "hidden",
        }}
      />
    </div>
  );
}

export default Terminal;
