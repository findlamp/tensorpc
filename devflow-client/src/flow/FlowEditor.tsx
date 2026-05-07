import { useState, useCallback, useEffect, useContext, useRef } from "react";
import type { CSSProperties } from "react";
import Editor from "@monaco-editor/react";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import "../components/viewers/MonacoEditor";
import { TensorPcContext } from "../context/TensorPcContext";
import { LayoutContext } from "../context/LayoutContext";
import { FlowRpcClient } from "./hooks/FlowRpc";
import type { FlowGraphData, FlowNode, LoadGraphResponse, AppTemplate, NodeStatus } from "./types";
import { LayoutRoot, applyUpdateComponents, extractUpdateLayout, normalizeLayoutPayload } from "../components/LayoutRoot";
import type { LayoutModel } from "../hooks/useLayoutModel";
import type { AppEventMessage } from "../core/tensorPcWs";
import { AppEventType, FrontendEventType } from "../core/socketTypes";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function SidebarToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <rect
        x="3.25"
        y="3.25"
        width="11.5"
        height="11.5"
        rx="2.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M6.9 4.85v8.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.35"
        opacity="0.78"
      />
    </svg>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findFlowComponentUid(layout: LayoutModel | null): string | null {
  if (!layout) return null;
  for (const [uid, comp] of Object.entries(layout.layout)) {
    if (comp.type === 0x8001) return uid;
  }
  return null;
}

function terminalContentToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (ArrayBuffer.isView(value)) {
    return new TextDecoder().decode(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    );
  }
  if (value instanceof ArrayBuffer) return new TextDecoder().decode(value);
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function sanitizeStartupTerminalContent(content: string) {
  return content
    .replace(/node_id_to_remove\s+\[[^\n]*\]/g, "")
    .replace(/SAVE GRAPH\s+\d+/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function publishStartupTerminalContent(content: string) {
  const sanitizedContent = sanitizeStartupTerminalContent(content);
  (window as unknown as { __tensorpcStartupTerminalContent?: string }).__tensorpcStartupTerminalContent =
    sanitizedContent;
  window.dispatchEvent(
    new CustomEvent("tensorpc-startup-terminal-content", {
      detail: { content: sanitizedContent },
    }),
  );
}

function parseConnectionUrl(wsUrl?: string) {
  try {
    const parsed = new URL(wsUrl ?? "");
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const hasClientId = pathParts.length > 2;
    const clientId = hasClientId ? pathParts.pop() ?? "" : "";
    const path = pathParts.length > 0 ? `/${pathParts.join("/")}` : "/api/ws";
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port || (parsed.protocol === "wss:" ? "443" : "80"),
      path,
      clientId,
    };
  } catch {
    return {
      host: "localhost",
      port: "51052",
      path: "/api/ws",
      clientId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    };
  }
}

function buildConnectionUrl(draft: ReturnType<typeof parseConnectionUrl>) {
  const host = draft.host.trim() || "localhost";
  const port = draft.port.trim();
  const normalizedPath = `/${draft.path.trim().replace(/^\/+/, "").replace(/\/+$/, "") || "api/ws"}`;
  const clientId =
    draft.clientId.trim() ||
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `ws://${host}${port ? `:${port}` : ""}${normalizedPath}/${clientId}`;
}

function normalizeNodeRuntimeStatus(status: Partial<NodeStatus> | null | undefined): string {
  if (!status) return "idle";
  if (status.sessionStatus === 0 && status.status !== "error") return "running";
  return status.status ?? "idle";
}

function childUidsOf(comp: { props?: Record<string, unknown> } | undefined) {
  const childs = comp?.props?.childs;
  return Array.isArray(childs) ? childs.map((uid) => String(uid)) : [];
}

function subtreeContainsEditorForNode(
  layout: LayoutModel,
  uid: string,
  nodeId: string | null,
  seen = new Set<string>(),
): boolean {
  if (seen.has(uid)) return false;
  seen.add(uid);
  const comp = layout.layout[uid];
  if (!comp) return false;
  const props = comp.props ?? {};
  const path = typeof props.path === "string" ? props.path : "";
  if (comp.type === 0x2c && (!nodeId || path.includes(nodeId))) return true;
  if (uid.includes(".editor-") && (!nodeId || uid.includes(`editor-${nodeId}`))) return true;
  return childUidsOf(comp).some((childUid) =>
    subtreeContainsEditorForNode(layout, childUid, nodeId, seen),
  );
}

function subtreeContainsType(
  layout: LayoutModel,
  uid: string,
  type: number,
  seen = new Set<string>(),
): boolean {
  if (seen.has(uid)) return false;
  seen.add(uid);
  const comp = layout.layout[uid];
  if (!comp) return false;
  if (comp.type === type) return true;
  return childUidsOf(comp).some((childUid) =>
    subtreeContainsType(layout, childUid, type, seen),
  );
}

function isComputeEditorPane(layout: LayoutModel, uid: string): boolean {
  if (uid.includes(".editor-")) return true;
  return (
    subtreeContainsEditorForNode(layout, uid, null) &&
    !subtreeContainsType(layout, uid, 0x8001)
  );
}

function setComputeEditorVisible(
  layout: LayoutModel | null,
  nodeId: string | null,
): LayoutModel | null {
  if (!layout) return layout;
  let changed = false;
  const nextEntries = { ...layout.layout };

  for (const [uid, comp] of Object.entries(layout.layout)) {
    const complex = comp.props?.childsComplex;
    if (!isRecord(complex) || !Array.isArray(complex.paneDefs)) continue;
    const paneDefs = complex.paneDefs as Array<Record<string, unknown>>;
    const nextPaneDefs = paneDefs.map((pane) => ({ ...pane }));
    let paneChanged = false;
    const editorPaneIndices = nextPaneDefs
      .map((pane, index) => {
        const paneUid = typeof pane.component === "string" ? pane.component : "";
        if (!paneUid) return -1;
        return isComputeEditorPane(layout, paneUid) ? index : -1;
      })
      .filter((index) => index >= 0);
    const matchedEditorPaneIndices =
      nodeId === null
        ? []
        : editorPaneIndices.filter((index) => {
            const paneUid =
              typeof nextPaneDefs[index]?.component === "string"
                ? String(nextPaneDefs[index]?.component)
                : "";
            return paneUid
              ? subtreeContainsEditorForNode(layout, paneUid, nodeId)
              : false;
          });
    const fallbackEditorPaneIndex =
      nodeId !== null && matchedEditorPaneIndices.length === 0
        ? editorPaneIndices[0]
        : undefined;

    nextPaneDefs.forEach((pane, index) => {
      const paneUid = typeof pane.component === "string" ? pane.component : "";
      if (!paneUid) return;
      if (!editorPaneIndices.includes(index)) return;
      const shouldShow =
        nodeId !== null &&
        (matchedEditorPaneIndices.includes(index) ||
          fallbackEditorPaneIndex === index);
      if (pane.visible !== shouldShow) {
        pane.visible = shouldShow;
        paneChanged = true;
      }
      if (shouldShow && index > 0 && typeof nextPaneDefs[0] === "object") {
        nextPaneDefs[0] = { ...nextPaneDefs[0], visible: true };
      }
    });

    if (paneChanged) {
      nextEntries[uid] = {
        ...comp,
        props: {
          ...comp.props,
          childsComplex: {
            ...complex,
            paneDefs: nextPaneDefs,
          },
        },
      };
      changed = true;
    }
  }

  return changed ? { ...layout, layout: nextEntries } : layout;
}

function applyEditorDraftValues(
  layout: LayoutModel | null,
  drafts: Record<string, string>,
): LayoutModel | null {
  if (!layout || Object.keys(drafts).length === 0) return layout;
  let changed = false;
  const nextEntries = { ...layout.layout };
  for (const [uid, comp] of Object.entries(layout.layout)) {
    if (!comp || comp.type !== 0x2c) continue;
    const compUid = typeof comp.uid === "string" ? comp.uid : uid;
    const path = typeof comp.props?.path === "string" ? comp.props.path : "";
    const value = drafts[uid] ?? drafts[compUid] ?? (path ? drafts[path] : undefined);
    if (typeof value !== "string" || comp.props?.value === value) continue;
    nextEntries[uid] = {
      ...comp,
      props: {
        ...comp.props,
        value,
      },
    };
    changed = true;
  }
  return changed ? { ...layout, layout: nextEntries } : layout;
}

function cacheEditorDraftValues(
  layout: LayoutModel | null,
  drafts: Record<string, string>,
  overwrite = true,
) {
  if (!layout) return;
  const writeDraft = (key: string | undefined, value: string) => {
    if (!key) return;
    if (!overwrite && drafts[key] !== undefined) return;
    drafts[key] = value;
  };
  for (const [uid, comp] of Object.entries(layout.layout)) {
    if (!comp || comp.type !== 0x2c) continue;
    const value = comp.props?.value;
    if (typeof value !== "string" || value.length === 0) continue;
    writeDraft(uid, value);
    writeDraft(typeof comp.uid === "string" ? comp.uid : undefined, value);
    writeDraft(typeof comp.props?.path === "string" ? comp.props.path : undefined, value);
  }
}

export function FlowEditor({
  sidebarVisible = true,
  themeMode = "dark",
  connectionUrl,
  onThemeToggle,
  onToggleSidebar,
}: {
  sidebarVisible?: boolean;
  themeMode?: "dark" | "light";
  connectionUrl?: string;
  onThemeToggle?: () => void;
  onToggleSidebar?: () => void;
}) {
  const isDarkTheme = themeMode === "dark";
  const {
    status,
    setUrl,
    disconnect,
    subscribeToAppEvents,
    subscribeToCommandNodeEvents,
  } = useContext(TensorPcContext);
  const { setGraphContext } = useContext(LayoutContext);
  const [rpc] = useState(() => new FlowRpcClient());
  const [graphs, setGraphs] = useState<FlowGraphData[]>([]);
  const [activeGraphId, setActiveGraphId] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, string>>({});
  const [, setTerminalContent] = useState<string>("");
  const [appLayout, setAppLayout] = useState<LayoutModel | null>(null);
  const [appLayoutNodeId, setAppLayoutNodeId] = useState<string | null>(null);
  const [appTemplates, setAppTemplates] = useState<AppTemplate[]>([]);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
  const [isWorkbenchDragOver, setIsWorkbenchDragOver] = useState(false);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [connectionDraft, setConnectionDraft] = useState(() =>
    parseConnectionUrl(connectionUrl),
  );
  const [isWorkspaceFullscreen, setIsWorkspaceFullscreen] = useState(false);
  const [, setSshSettingsNodeId] = useState<string | null>(null);
  const activeGraphIdRef = useRef(activeGraphId);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const selectedComputeNodeIdRef = useRef<string | null>(null);
  const appLayoutRef = useRef(appLayout);
  const appLayoutNodeIdRef = useRef(appLayoutNodeId);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const appRuntimeRef = useRef<HTMLDivElement>(null);
  const graphMutationTimerRef = useRef<number | null>(null);
  const appRuntimeHydrationKeyRef = useRef("");
  const editorDraftsRef = useRef<Record<string, string>>({});

  const preserveEditorDrafts = useCallback((layout: LayoutModel | null) => {
    cacheEditorDraftValues(appLayoutRef.current, editorDraftsRef.current, false);
    cacheEditorDraftValues(layout, editorDraftsRef.current, false);
    return applyEditorDraftValues(layout, editorDraftsRef.current);
  }, []);

  useEffect(() => {
    activeGraphIdRef.current = activeGraphId;
  }, [activeGraphId]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    appLayoutRef.current = appLayout;
  }, [appLayout]);

  useEffect(() => {
    appLayoutNodeIdRef.current = appLayoutNodeId;
  }, [appLayoutNodeId]);

  useEffect(() => {
    if (!connectionDialogOpen) {
      setConnectionDraft(parseConnectionUrl(connectionUrl));
    }
  }, [connectionDialogOpen, connectionUrl]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement === workspaceRef.current) {
        setIsWorkspaceFullscreen(true);
      } else if (!document.fullscreenElement) {
        setIsWorkspaceFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleEditorDraft = (event: Event) => {
      const custom = event as CustomEvent<{ uid?: string; path?: string; value?: string }>;
      const uid = custom.detail?.uid;
      const path = custom.detail?.path;
      if (typeof custom.detail?.value !== "string") return;
      if (uid) editorDraftsRef.current[uid] = custom.detail.value;
      if (path) editorDraftsRef.current[path] = custom.detail.value;
    };
    window.addEventListener("tensorpc-monaco-value-change", handleEditorDraft);
    return () => {
      window.removeEventListener("tensorpc-monaco-value-change", handleEditorDraft);
    };
  }, []);

  // ── localStorage helpers ──
  const LS_KEY = "tensorpc-flow-graphs";

  const saveToLocal = useCallback((gList: FlowGraphData[]) => {
    try {
      const json = JSON.stringify(gList);
      localStorage.setItem(LS_KEY, json);
      // Verify immediately
      const verify = localStorage.getItem(LS_KEY);
      const nodeCount = gList.reduce((s, g) => s + g.nodes.length, 0);
      const kb = (json.length / 1024).toFixed(1);
      console.log(`💾 Saved to localStorage: ${gList.length} graphs, ${nodeCount} nodes (${kb} KB) verify=${verify ? 'OK' : 'FAIL'}`);
      setStatusMsg(`💾 Saved ${nodeCount} nodes locally (${kb} KB)`);
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (e) {
      console.error("localStorage save failed:", e);
      setStatusMsg(`❌ Save failed: ${e}`);
    }
  }, []);

  const loadFromLocal = useCallback((): FlowGraphData[] | null => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      console.log(`📂 localStorage raw: ${raw ? raw.substring(0, 100) + '...' : 'null'}`);
      if (raw) {
        const data = JSON.parse(raw) as FlowGraphData[];
        console.log(`📂 Loaded: ${data.length} graphs, ${data.reduce((s, g) => s + g.nodes.length, 0)} nodes`);
        return data;
      }
      console.log("📂 localStorage empty");
      return null;
    } catch (e) {
      console.error("localStorage load failed:", e);
      return null;
    }
  }, []);

  // Show locally saved graphs immediately, even before the backend connection
  // finishes. The backend load below can replace this if it has real data.
  useEffect(() => {
    const cached = loadFromLocal();
    if (cached && cached.length > 0 && cached.some((g) => g.nodes.length > 0)) {
      setGraphs(cached);
      setActiveGraphId(cached[0]!.id);
      const nodeCount = cached.reduce((s, g) => s + g.nodes.length, 0);
      setStatusMsg(`📂 Loaded ${nodeCount} nodes from local cache`);
    }
    setGraphLoading(false);
  }, [loadFromLocal]);

  // Load graph & subscribe on connection
  useEffect(() => {
    if (status !== "connected") return;

    console.log("FlowEditor: connected, loading graph and subscribing...");

    const loadGraph = async () => {
      try {
        setGraphLoading(true);
        setGraphError(null);
        const data: LoadGraphResponse = await rpc.loadDefaultGraph();
        console.log("FlowEditor: graph loaded from backend", {
          flows: data.flows?.length,
          templates: data.appTemplates?.length,
        });

        const backendFlows = data.flows || [];
        const hasBackendNodes = backendFlows.some((f) => f.nodes?.length > 0);

        if (hasBackendNodes) {
          // Backend has data → use it
          setGraphs(backendFlows);
          setActiveGraphId(backendFlows[0]!.id);
          saveToLocal(backendFlows);
          setStatusMsg(`✅ Loaded from backend`);
        } else {
          // Backend empty → try localStorage
          const cached = loadFromLocal();
          if (cached && cached.length > 0 && cached.some((g) => g.nodes.length > 0)) {
            console.log("FlowEditor: backend empty, using localStorage cache");
            setGraphs(cached);
            setActiveGraphId(cached[0]!.id);
            setStatusMsg(`📂 Backend empty, loaded from local cache`);
          } else {
            setGraphs(backendFlows);
            setActiveGraphId(backendFlows[0]?.id ?? "");
            setStatusMsg(`Backend returned empty graph`);
          }
        }

        setAppTemplates(data.appTemplates || []);
        const statuses: Record<string, string> = {};
        for (const [nodeId, s] of Object.entries(data.nodeStatus || {})) {
          statuses[nodeId] = normalizeNodeRuntimeStatus(s);
        }
        setNodeStatuses(statuses);
      } catch (e) {
        console.error("Failed to load graph from backend:", e);
        // Fall back to localStorage
        const cached = loadFromLocal();
        if (cached && cached.length > 0) {
          console.log("FlowEditor: loaded from localStorage", cached.length, "graphs");
          setGraphs(cached);
          setActiveGraphId(cached[0]!.id);
          setGraphError(null);
          const nodeCount = cached.reduce((s, g) => s + g.nodes.length, 0);
          setStatusMsg(`📂 Loaded ${nodeCount} nodes from local cache`);
        } else {
          setGraphError(String(e));
        }
      } finally {
        setGraphLoading(false);
      }
    };
    loadGraph();

    // Subscribe to app events
    console.log("FlowEditor: subscribing to app events...");
    subscribeToAppEvents((ev: AppEventMessage) => {
      console.log("FlowEditor: received app event", {
        uid: ev.uid,
        types: ev.typeToEvents?.map(([t]) => t) ?? [],
      });
      const lay = extractUpdateLayout(ev);
      if (lay) {
        console.log("FlowEditor: UpdateLayout found!", lay);
        const [, eventNodeId] = String(ev.uid ?? "").split("@");
        const appNodeId = eventNodeId || selectedNodeIdRef.current;
        if (activeGraphIdRef.current && appNodeId) {
          setGraphContext(activeGraphIdRef.current, appNodeId);
          setAppLayoutNodeId(appNodeId);
          setNodeStatuses((prev) => ({ ...prev, [appNodeId]: "running" }));
        }
        setAppLayout(preserveEditorDrafts(setComputeEditorVisible(lay, null)));
      } else {
        for (const [type, payload] of ev.typeToEvents ?? []) {
          if (type === AppEventType.UpdateComponents) {
            setAppLayout((current) => preserveEditorDrafts(applyUpdateComponents(current, payload)));
          } else if (type === AppEventType.ComponentEvent && isRecord(payload)) {
            for (const [uid, data] of Object.entries(payload)) {
              window.dispatchEvent(
                new CustomEvent("tensorpc-component-event", {
                  detail: { uid, data },
                }),
              );
            }
          }
        }
        console.log("FlowEditor: no UpdateLayout in this event");
      }
    });

    subscribeToCommandNodeEvents((ev) => {
      const selectedUid =
        activeGraphIdRef.current && selectedNodeIdRef.current
          ? `${activeGraphIdRef.current}@${selectedNodeIdRef.current}`
          : "";
      if (!selectedUid || ev.uid !== selectedUid || !isRecord(ev.data)) return;
      if (ev.data.type === "R" && "raw" in ev.data) {
        const text = terminalContentToString(ev.data.raw);
        if (!text) return;
        setTerminalContent((current) => {
          const next = current + text;
          publishStartupTerminalContent(next);
          return next;
        });
      } else if (ev.data.type === "Eof") {
        setTerminalContent((current) => {
          const next = `${current}\n[process exited]\n`;
          publishStartupTerminalContent(next);
          return next;
        });
      }
    });
  }, [status, rpc, setGraphContext, subscribeToAppEvents, subscribeToCommandNodeEvents]);

  const activeGraph = graphs.find((g) => g.id === activeGraphId) ?? null;
  const allNodes = activeGraph?.nodes ?? [];
  const selectedNode = allNodes.find((n) => n.id === selectedNodeId) ?? null;
  const appNodes = allNodes.filter((node) => node.type === "app");
  const sshNodes = allNodes.filter((node) => node.type === "directssh");
  const selectedFlowNode = selectedNode ?? appNodes[0] ?? sshNodes[0] ?? allNodes[0] ?? null;
  const currentAppNode =
    (selectedNode?.type === "app" ? selectedNode : null) ??
    allNodes.find((node) => node.type === "app" && nodeStatuses[node.id] === "running") ??
    allNodes.find((node) => node.type === "app") ??
    null;

  useEffect(() => {
    if (selectedNodeId || !activeGraph) return;
    const defaultNode = activeGraph.nodes.find((node) => node.type === "app") ?? activeGraph.nodes[0];
    if (defaultNode) setSelectedNodeId(defaultNode.id);
  }, [activeGraph, selectedNodeId]);

  const hydrateAppRuntime = useCallback(
    async (graphId: string, appNode: FlowNode) => {
      if (appNode.type !== "app") return false;

      setGraphContext(graphId, appNode.id);
      let runtimeStatus = nodeStatuses[appNode.id] ?? "idle";

      try {
        const nodeStatus = await rpc.queryNodeStatus(graphId, appNode.id);
        runtimeStatus = normalizeNodeRuntimeStatus(nodeStatus);
        setNodeStatuses((prev) => ({ ...prev, [appNode.id]: runtimeStatus }));
        if (nodeStatus.sessionStatus === 1) {
          if (appLayoutNodeIdRef.current === appNode.id) {
            setAppLayout(null);
            setAppLayoutNodeId(null);
          }
          return false;
        }
      } catch (err) {
        console.warn("queryNodeStatus during app runtime hydrate failed:", err);
      }

      try {
        const content = terminalContentToString(
          await rpc.selectNode(graphId, appNode.id, 120, 30),
        );
        setTerminalContent(content);
        publishStartupTerminalContent(content);
      } catch {
        // Some app sessions may not have terminal scrollback yet.
      }

      try {
        const layoutState = normalizeLayoutPayload(
          await rpc.queryAppState(graphId, appNode.id),
        );
        if (!layoutState) {
          if (runtimeStatus === "running") {
            setStatusMsg(`App ${appNode.data.readableNodeId || appNode.id} is running; waiting for layout...`);
          }
          return false;
        }
        setGraphContext(graphId, appNode.id);
        setAppLayoutNodeId(appNode.id);
        setAppLayout(
          preserveEditorDrafts(
            setComputeEditorVisible(layoutState, selectedComputeNodeIdRef.current),
          ),
        );
        setStatusMsg("");
        return true;
      } catch (err) {
        console.warn("queryAppState during app runtime hydrate failed:", err);
        if (runtimeStatus === "running") {
          setStatusMsg(
            `App ${appNode.data.readableNodeId || appNode.id} is running, but layout query failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        return false;
      }
    },
    [nodeStatuses, rpc, setGraphContext],
  );

  useEffect(() => {
    if (status !== "connected" || !activeGraph || selectedFlowNode?.type !== "app") return;
    if (appLayout && appLayoutNodeId === selectedFlowNode.id) return;
    const key = `${activeGraph.id}@${selectedFlowNode.id}@${nodeStatuses[selectedFlowNode.id] ?? ""}`;
    if (appRuntimeHydrationKeyRef.current === key) return;
    appRuntimeHydrationKeyRef.current = key;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void hydrateAppRuntime(activeGraph.id, selectedFlowNode);
    }, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    activeGraph,
    appLayout,
    appLayoutNodeId,
    hydrateAppRuntime,
    nodeStatuses,
    selectedFlowNode,
    status,
  ]);

  useEffect(() => {
    if (!activeGraph || !selectedNode) {
      setTerminalContent("");
      return;
    }
    if (selectedNode.type !== "app" && selectedNode.type !== "command") return;

    let cancelled = false;
    void rpc
      .selectNode(activeGraph.id, selectedNode.id, 120, 30)
      .then((payload) => {
        if (cancelled) return;
        const content = terminalContentToString(payload);
        setTerminalContent(content);
        if (selectedNode.type === "app") publishStartupTerminalContent(content);
      })
      .catch(() => {
        if (!cancelled) setTerminalContent("");
      });

    return () => {
      cancelled = true;
    };
  }, [activeGraph, rpc, selectedNode]);

  useEffect(() => {
    const handleSelection = (event: Event) => {
      const custom = event as CustomEvent<{ nodeId?: string | null; openEditor?: boolean }>;
      const nodeId = custom.detail?.nodeId ?? null;
      const editorNodeId = custom.detail?.openEditor ? nodeId : null;
      selectedComputeNodeIdRef.current = editorNodeId;
      setAppLayout((current) =>
        preserveEditorDrafts(setComputeEditorVisible(current, editorNodeId)),
      );
      if (!custom.detail?.openEditor) return;
      if (!activeGraphIdRef.current || !selectedNodeIdRef.current || !nodeId) return;
      const graphId = activeGraphIdRef.current;
      const appNodeId = selectedNodeIdRef.current;
      const currentLayout = appLayoutRef.current;
      const flowUid = findFlowComponentUid(currentLayout);
      if (!flowUid) return;
      const flowComp = currentLayout?.layout[flowUid];
      const complex = flowComp?.props?.childsComplex;
      const flowNodes = isRecord(complex) && Array.isArray(complex.nodes)
        ? complex.nodes
        : [];
      const nodeExists = flowNodes.some(
        (node) => isRecord(node) && String(node.id ?? "") === nodeId,
      );
      if (!nodeExists) return;
      window.setTimeout(() => {
        void rpc
          .runUiEvent(
            graphId,
            appNodeId,
            flowUid,
            FrontendEventType.FlowSelectionChange,
            { nodes: [nodeId], edges: [] },
          )
          .then(() => rpc.queryAppState(graphId, appNodeId))
          .then((payload) => {
            const layoutState = normalizeLayoutPayload(payload);
            if (layoutState) {
              setAppLayoutNodeId(appNodeId);
              setAppLayout(preserveEditorDrafts(setComputeEditorVisible(layoutState, editorNodeId)));
            }
          })
          .catch((err) => console.warn("flow selection editor sync failed:", err));
      }, 80);
    };
    window.addEventListener("tensorpc-flow-node-selection", handleSelection);
    return () => {
      window.removeEventListener("tensorpc-flow-node-selection", handleSelection);
    };
  }, [rpc]);

  useEffect(() => {
    const handleGraphMutation = () => {
      if (graphMutationTimerRef.current !== null) {
        window.clearTimeout(graphMutationTimerRef.current);
      }
      graphMutationTimerRef.current = window.setTimeout(() => {
        graphMutationTimerRef.current = null;
        const graphId = activeGraphIdRef.current;
        const appNodeId = selectedNodeIdRef.current;
        if (!graphId || !appNodeId) return;
        void rpc
          .queryAppState(graphId, appNodeId)
          .then((payload) => {
            const layoutState = normalizeLayoutPayload(payload);
            if (layoutState) {
              setAppLayoutNodeId(appNodeId);
              setAppLayout(
                preserveEditorDrafts(
                  setComputeEditorVisible(
                    layoutState,
                    selectedComputeNodeIdRef.current,
                  ),
                ),
              );
            }
          })
          .catch((err) => console.warn("queryAppState after flow mutation failed:", err));
      }, 180);
    };
    window.addEventListener("tensorpc-flow-graph-mutated", handleGraphMutation);
    return () => {
      window.removeEventListener("tensorpc-flow-graph-mutated", handleGraphMutation);
      if (graphMutationTimerRef.current !== null) {
        window.clearTimeout(graphMutationTimerRef.current);
        graphMutationTimerRef.current = null;
      }
    };
  }, [rpc]);

  // ── Node operations ──

  const handleAddNode = useCallback(
    (type: string) => {
      let graph = activeGraph;
      if (!graph) {
        const defaultId = "default";
        graph = { id: defaultId, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
        setGraphs([graph]);
        setActiveGraphId(defaultId);
      }

      const id = `${type}_${Date.now().toString(36)}`;
      const newNode: FlowNode = {
        id,
        type,
        position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
        data: {
          graphId: graph.id,
          readableNodeId: id, url: "", username: "", password: "",
          module: "", initCode: "", initConfig: "{}",
        },
      };
      const updated: FlowGraphData = { ...graph, nodes: [...graph.nodes, newNode] };
      setGraphs((prev) => {
        const exists = prev.find((g) => g.id === graph.id);
        return exists ? prev.map((g) => (g.id === graph.id ? updated : g)) : [...prev, updated];
      });
      setSelectedNodeId(id);
      setSshSettingsNodeId(type === "directssh" ? id : null);
      console.log(`Added ${type} node: ${id}`);
    },
    [activeGraph],
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      if (!activeGraph) return;
      const updated: FlowGraphData = {
        ...activeGraph,
        nodes: activeGraph.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } as FlowNode["data"] } : n,
        ),
      };
      setGraphs((prev) => prev.map((g) => (g.id === activeGraph.id ? updated : g)));
      console.log(`Updated node ${nodeId}`);
    },
    [activeGraph],
  );

  const handleDeleteNode = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>, node: FlowNode) => {
      event.stopPropagation();
      if (!activeGraph) return;
      const label = nodeLabel(node);
      if (!window.confirm(`Delete ${label}?`)) return;

      const updatedNodes = activeGraph.nodes
        .filter((item) => item.id !== node.id)
        .map((item) => {
          if (node.type !== "directssh") return item;
          const driver = item.data.driver;
          if (driver !== node.id && driver !== node.data.readableNodeId) return item;
          return {
            ...item,
            data: {
              ...item.data,
              driver: "",
            },
          };
        });
      const updated: FlowGraphData = {
        ...activeGraph,
        nodes: updatedNodes,
        edges: activeGraph.edges.filter(
          (edge) => edge.source !== node.id && edge.target !== node.id,
        ),
      };
      setGraphs((prev) => prev.map((g) => (g.id === activeGraph.id ? updated : g)));
      setNodeStatuses((prev) => {
        const next = { ...prev };
        delete next[node.id];
        return next;
      });
      if (selectedNodeIdRef.current === node.id) {
        const fallback = updated.nodes.find((item) => item.type === node.type) ?? updated.nodes[0] ?? null;
        setSelectedNodeId(fallback?.id ?? null);
      }
      if (appLayoutNodeIdRef.current === node.id) {
        setAppLayout(null);
        setAppLayoutNodeId(null);
        selectedComputeNodeIdRef.current = null;
      }
      try {
        if (node.type === "app" && nodeStatuses[node.id] === "running") {
          await rpc.stopNode(activeGraph.id, node.id).catch(() => undefined);
        }
        await rpc.saveGraph(activeGraph.id, updated);
        setStatusMsg(`Deleted ${label}`);
      } catch (err) {
        setStatusMsg(
          `Deleted locally; backend sync failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    },
    [activeGraph, nodeStatuses, rpc],
  );

  // Auto-save to localStorage whenever graphs change (only if has nodes)
  useEffect(() => {
    if (graphs.length > 0 && graphs.some((g) => g.nodes.length > 0)) {
      saveToLocal(graphs);
    }
  }, [graphs, saveToLocal]);

  const handleStartNode = useCallback(async () => {
    if (!selectedNode || !activeGraph) {
      console.warn("Start: no node selected or no active graph", { selectedNode, activeGraph });
      return;
    }
    console.log(`Start: ${selectedNode.type} node ${selectedNode.id} on graph ${activeGraph.id}`);
    try {
      await rpc.saveGraph(activeGraph.id, activeGraph);
      await rpc.startNode(activeGraph.id, selectedNode.id);
      console.log(`Start: success`);
      setNodeStatuses((prev) => ({ ...prev, [selectedNode.id]: "running" }));
      setStatusMsg(`▶ Started ${selectedNode.data.readableNodeId || selectedNode.id}`);

      if (selectedNode.type === "app") {
        setGraphContext(activeGraph.id, selectedNode.id);
        const startupContent = terminalContentToString(
          await rpc.selectNode(activeGraph.id, selectedNode.id, 120, 30).catch(() => ""),
        );
        if (startupContent) {
          setTerminalContent(startupContent);
          publishStartupTerminalContent(startupContent);
        }
        setStatusMsg(`▶ Started ${selectedNode.data.readableNodeId || selectedNode.id}; waiting for layout...`);
        let loadedLayout = false;
        let lastLayoutError = "";
        for (let i = 0; i < 30; i++) {
          const nodeStatus = await rpc.queryNodeStatus(activeGraph.id, selectedNode.id);
          setNodeStatuses((prev) => ({
            ...prev,
            [selectedNode.id]: normalizeNodeRuntimeStatus(nodeStatus),
          }));
          if (nodeStatus.sessionStatus === 1) {
            const content = terminalContentToString(
              await rpc.selectNode(activeGraph.id, selectedNode.id, 120, 30).catch(() => ""),
            );
            if (content) {
              setTerminalContent(content);
              publishStartupTerminalContent(content);
            }
            setStatusMsg(`⚠️ App session stopped before layout was available`);
            break;
          }
          const layoutState = normalizeLayoutPayload(
            await rpc.queryAppState(activeGraph.id, selectedNode.id).catch((err) => {
              console.warn(`queryAppState attempt ${i + 1} failed:`, err);
              lastLayoutError = err instanceof Error ? err.message : String(err);
              return null;
            }),
          );
          if (layoutState) {
            setGraphContext(activeGraph.id, selectedNode.id);
            const latestContent = terminalContentToString(
              await rpc.selectNode(activeGraph.id, selectedNode.id, 120, 30).catch(() => ""),
            );
            if (latestContent) {
              setTerminalContent(latestContent);
              publishStartupTerminalContent(latestContent);
            }
            setAppLayoutNodeId(selectedNode.id);
            setAppLayout(preserveEditorDrafts(setComputeEditorVisible(layoutState, null)));
            setStatusMsg(`✅ App layout loaded`);
            loadedLayout = true;
            break;
          }
          await delay(1000);
        }
        if (!loadedLayout) {
          setStatusMsg(
            lastLayoutError
              ? `⚠️ App started, but layout query failed: ${lastLayoutError}`
              : "⚠️ App started, but no layout was available yet",
          );
        }
      }
    } catch (e) {
      console.warn("Start: failed", e);
      setStatusMsg(`❌ Start failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [selectedNode, activeGraph, rpc, setGraphContext]);

  const handleStopNode = useCallback(async () => {
    const appNode =
      (selectedFlowNode?.type === "app" ? selectedFlowNode : null) ??
      (selectedNode?.type === "app" ? selectedNode : null) ??
      currentAppNode;
    if (!appNode || !activeGraph) return;
    try {
      await rpc.stopNode(activeGraph.id, appNode.id);
      setNodeStatuses((prev) => ({ ...prev, [appNode.id]: "idle" }));
      setAppLayout(null);
      setAppLayoutNodeId(null);
      selectedComputeNodeIdRef.current = null;
      setStatusMsg(`Stopped ${appNode.data.readableNodeId || appNode.id}`);
    } catch (e) {
      console.warn("Failed to stop node:", e);
      setStatusMsg(`Stop app failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [activeGraph, currentAppNode, rpc, selectedFlowNode, selectedNode]);

  const handleStopSession = useCallback(async () => {
    const appNode =
      (selectedFlowNode?.type === "app" ? selectedFlowNode : null) ?? currentAppNode;
    if (!appNode || !activeGraph) {
      setAppLayout(null);
      setAppLayoutNodeId(null);
      selectedComputeNodeIdRef.current = null;
      setStatusMsg("App session cleared");
      return;
    }
    try {
      await rpc.stopSession(activeGraph.id, appNode.id);
      setAppLayout(null);
      setAppLayoutNodeId(null);
      selectedComputeNodeIdRef.current = null;
      setStatusMsg(`Stopped session ${appNode.data.readableNodeId || appNode.id}`);
    } catch (e) {
      console.warn("Failed to stop app session:", e);
      setStatusMsg(`Stop session failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [activeGraph, currentAppNode, rpc, selectedFlowNode]);

  const handleFullscreenApp = useCallback(() => {
    const elem = workspaceRef.current ?? document.documentElement;
    if (isWorkspaceFullscreen) {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch((err) => {
          setStatusMsg(`Exit fullscreen failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
      setIsWorkspaceFullscreen(false);
      return;
    }
    setIsWorkspaceFullscreen(true);
    void elem.requestFullscreen().catch((err) => {
      console.warn("Native fullscreen failed; using app fullscreen layout:", err);
    });
  }, [isWorkspaceFullscreen]);

  const handleApplyConnection = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextUrl = buildConnectionUrl(connectionDraft);
      disconnect();
      setUrl(nextUrl);
      setConnectionDialogOpen(false);
      setStatusMsg(`WS set to ${nextUrl.replace("/api/ws/", "/").replace("127.0.0.1", "localhost")}`);
    },
    [connectionDraft, disconnect, setUrl],
  );

  const handleSelectNode = useCallback(
    async (nodeId: string | null) => {
      setSelectedNodeId(nodeId);
      const node = nodeId ? allNodes.find((n) => n.id === nodeId) : null;
      setSshSettingsNodeId(node?.type === "directssh" ? nodeId : null);

      if (nodeId && activeGraph) {
        if (node?.type === "command" || node?.type === "app") {
          try {
            const content = terminalContentToString(
              await rpc.selectNode(activeGraph.id, nodeId, 120, 30),
            );
            setTerminalContent(content);
            if (node.type === "app") publishStartupTerminalContent(content);
          } catch {
            // Terminal not available
          }
        }
        if (node?.type === "app") {
          void hydrateAppRuntime(activeGraph.id, node);
        } else if (appLayoutNodeIdRef.current !== nodeId) {
          setAppLayout(null);
          setAppLayoutNodeId(null);
        }
      }
    },
    [activeGraph, allNodes, hydrateAppRuntime, rpc],
  );

  const handleSaveGraph = useCallback(async () => {
    if (!activeGraph) return;
    try {
      await rpc.saveGraph(activeGraph.id, activeGraph);
      setStatusMsg("Graph synced to backend");
    } catch (e) {
      console.warn("Failed to save graph:", e);
      setStatusMsg(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [activeGraph, rpc]);

  // ── Tab bar ──

  const nodeLabel = (node: FlowNode | null) =>
    node?.data.readableNodeId || node?.data.module || node?.id || "";

  const selectedFlowTitle = selectedFlowNode ? nodeLabel(selectedFlowNode) : "remote";

  const selectedFlowCode =
    selectedFlowNode?.type === "app"
      ? selectedFlowNode.data.initCode ||
        `from tensorpc.dock import mui, mark_create_layout\n\n\nclass App:\n    @mark_create_layout\n    def my_layout(self):\n        return mui.VBox([\n            mui.Typography(\"Hello DevDock\")\n        ]).prop(width=\"100%\", height=\"100%\")\n`
      : selectedFlowNode
        ? JSON.stringify(selectedFlowNode.data, null, 2)
        : "";

  const selectedTemplateLabel =
    appTemplates.find((template) => {
      if (template.module) {
        return template.module === selectedFlowNode?.data.module;
      }
      const templateCode = template.initCode ?? template.code ?? "";
      return templateCode !== "" && templateCode === selectedFlowNode?.data.initCode;
    })?.label ?? "";
  const selectedAppIsRunning =
    selectedFlowNode?.type === "app" &&
    (nodeStatuses[selectedFlowNode.id] === "running" ||
      (appLayoutNodeId === selectedFlowNode.id && Boolean(appLayout)));
  const selectedAppHasRuntime = Boolean(
    selectedFlowNode?.type === "app" && appLayout && appLayoutNodeId === selectedFlowNode.id,
  );
  const selectedAppDriver = selectedFlowNode?.type === "app" ? selectedFlowNode.data.driver ?? "" : "";
  const selectedDriverNode =
    sshNodes.find((node) => node.id === selectedAppDriver) ??
    sshNodes.find((node) => node.data.readableNodeId === selectedAppDriver) ??
    null;
  const editingSshNode = selectedFlowNode?.type === "directssh" ? selectedFlowNode : null;

  const handleAppDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, node: FlowNode) => {
      event.dataTransfer.setData("application/x-tensorpc-flow-node-id", node.id);
      event.dataTransfer.effectAllowed = "copy";
      setDraggedAppId(node.id);
    },
    [],
  );

  const handleAppDragEnd = useCallback(() => {
    setDraggedAppId(null);
    setIsWorkbenchDragOver(false);
  }, []);

  const handleWorkbenchDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("application/x-tensorpc-flow-node-id")) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsWorkbenchDragOver(true);
  }, []);

  const handleWorkbenchDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      const nodeId = event.dataTransfer.getData("application/x-tensorpc-flow-node-id");
      setDraggedAppId(null);
      setIsWorkbenchDragOver(false);
      if (!nodeId) return;
      event.preventDefault();
      const node = allNodes.find((item) => item.id === nodeId);
      if (!node || node.type !== "app") return;
      void handleSelectNode(nodeId);
      setStatusMsg(`Ready to start ${node.data.readableNodeId || node.id}`);
    },
    [allNodes, handleSelectNode],
  );

  const applyTemplate = (templateLabel: string) => {
    if (!selectedFlowNode || selectedFlowNode.type !== "app") return;
    const template = appTemplates.find((item) => item.label === templateLabel);
    if (!template) return;
    const templateCode = template.initCode ?? template.code ?? "";
    handleUpdateNode(selectedFlowNode.id, {
      module: template.module ?? "",
      initCode: templateCode || (selectedFlowNode.data.initCode ?? ""),
      initConfig: template.initConfig
        ? JSON.stringify(template.initConfig, null, 2)
        : selectedFlowNode.data.initConfig ?? "{}",
    });
  };

  const appIconButtonStyle = (enabled = true): CSSProperties => ({
    width: 30,
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
    borderRadius: 6,
    background: "transparent",
    color: enabled ? "var(--td-text-muted)" : "color-mix(in srgb, var(--td-text-muted) 45%, transparent)",
    cursor: enabled ? "pointer" : "default",
    lineHeight: 1,
    padding: 0,
  });

  const fieldLabelStyle: CSSProperties = {
    display: "block",
    color: "var(--td-text-muted)",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
  };

  const fieldInputStyle: CSSProperties = {
    width: "100%",
    minHeight: 36,
    border: "1px solid var(--td-input-border)",
    borderRadius: 4,
    padding: "7px 10px",
    color: "var(--td-text)",
    fontSize: 14,
    fontFamily: "Inter, system-ui, sans-serif",
    boxSizing: "border-box",
    background: "var(--td-input-bg)",
  };

  const sidebarNavStyle: CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 14,
    border: "none",
    background: "transparent",
    color: "var(--td-text)",
    padding: "8px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 500,
    textAlign: "left",
  };

  const sidebarSectionStyle: CSSProperties = {
    margin: "18px 16px 7px",
    color: "var(--td-text-muted)",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0,
  };

  const sidebarItemStyle = (active: boolean, draggable = false): CSSProperties => ({
    width: "100%",
    minHeight: 40,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    border: "none",
    borderRadius: 14,
    background: active ? "var(--td-sidebar-active)" : "transparent",
    color: active ? "var(--td-text-strong)" : "var(--td-text)",
    cursor: draggable ? "grab" : "pointer",
    textAlign: "left",
    fontSize: 14,
    fontWeight: active ? 650 : 500,
  });

  const sidebarBadgeStyle = (tone: "app" | "ssh"): CSSProperties => ({
    border: "1px solid var(--td-input-border)",
    color: tone === "app" ? "var(--td-green)" : "var(--td-text-muted)",
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    padding: "1px 4px",
    background: "color-mix(in srgb, var(--td-surface) 78%, transparent)",
    flexShrink: 0,
  });

  const displayConnectionUrl =
    connectionUrl?.replace("/api/ws/", "/").replace("127.0.0.1", "localhost") ?? "";

  return (
    <div
      ref={workspaceRef}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: isWorkspaceFullscreen ? "100vh" : "100%",
        position: isWorkspaceFullscreen ? "fixed" : "relative",
        inset: isWorkspaceFullscreen ? 0 : undefined,
        zIndex: isWorkspaceFullscreen ? 900 : undefined,
        background: "var(--td-bg)",
        color: "var(--td-text)",
      }}
    >
      <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "var(--td-bg)" }}>
        {!sidebarVisible && (
          <div
            style={{
              width: 48,
              flexShrink: 0,
              borderRight: "1px solid var(--td-border-soft)",
              background: "var(--td-sidebar-bg)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px 0",
              gap: 10,
            }}
          >
            <button
              type="button"
              title="Show sidebar"
              onClick={onToggleSidebar}
              style={{
                width: 34,
                height: 34,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid color-mix(in srgb, var(--td-border) 72%, transparent)",
                borderRadius: 12,
                background: isDarkTheme ? "#182333" : "#dcebf1",
                color: isDarkTheme ? "#c4ceda" : "#687681",
                cursor: "pointer",
              }}
            >
              <SidebarToggleIcon />
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              title="Toggle theme"
              onClick={onThemeToggle}
              style={{
                width: 32,
                height: 32,
                border: "1px solid var(--td-border)",
                borderRadius: 10,
                background: "var(--td-surface)",
                color: "var(--td-text)",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {isDarkTheme ? "☀" : "☾"}
            </button>
          </div>
        )}
        {sidebarVisible && (
          <aside
            style={{
              width: 282,
              flexShrink: 0,
              borderRight: "1px solid var(--td-border-soft)",
              background: "var(--td-sidebar-bg)",
              color: "var(--td-text)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <div
              style={{
                height: 58,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 16px",
                borderBottom: "1px solid var(--td-border-soft)",
                color: "var(--td-text)",
              }}
            >
              <button
                type="button"
                title="Collapse sidebar"
                onClick={onToggleSidebar}
                style={{
                  width: 34,
                  height: 34,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid color-mix(in srgb, var(--td-border) 72%, transparent)",
                  borderRadius: 12,
                  background: isDarkTheme ? "#182333" : "#dcebf1",
                  color: isDarkTheme ? "#c4ceda" : "#687681",
                  cursor: "pointer",
                }}
              >
                <SidebarToggleIcon />
              </button>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 750,
                  color: "var(--td-text-strong)",
                  lineHeight: 1,
                }}
              >
                Launcher
              </span>
            </div>

            <div style={{ padding: "10px 16px", display: "grid", gap: 4 }}>
              <button type="button" onClick={() => handleAddNode("app")} style={sidebarNavStyle}>
                <AddRoundedIcon fontSize="small" />
                New App
              </button>
              <button type="button" onClick={() => handleAddNode("directssh")} style={sidebarNavStyle}>
                <AddRoundedIcon fontSize="small" />
                New SSH
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: "auto", paddingBottom: 16 }}>
              <div style={sidebarSectionStyle}>Apps</div>
              <div style={{ display: "grid", gap: 4, padding: "0 10px" }}>
                {appNodes.map((node) => {
                  const isActive = selectedFlowNode?.id === node.id;
                  const running = nodeStatuses[node.id] === "running";
                  return (
                    <div
                      key={node.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => handleAppDragStart(event, node)}
                        onDragEnd={handleAppDragEnd}
                        onClick={() => void handleSelectNode(node.id)}
                        style={{
                          ...sidebarItemStyle(isActive, true),
                          width: "auto",
                          flex: 1,
                          minWidth: 0,
                          opacity: draggedAppId === node.id ? 0.55 : 1,
                          cursor: draggedAppId === node.id ? "grabbing" : "grab",
                        }}
                      >
                        <span style={sidebarBadgeStyle("app")}>APP</span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {nodeLabel(node)}
                        </span>
                        {running && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "var(--td-green)",
                              boxShadow: "0 0 0 3px color-mix(in srgb, var(--td-green) 18%, transparent)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        title={`Delete ${nodeLabel(node)}`}
                        onClick={(event) => void handleDeleteNode(event, node)}
                        style={{
                          ...appIconButtonStyle(true),
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                        }}
                      >
                        <DeleteRoundedIcon fontSize="small" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div style={sidebarSectionStyle}>SSH</div>
              <div style={{ display: "grid", gap: 4, padding: "0 10px" }}>
                {sshNodes.map((node) => {
                  const isActive = selectedFlowNode?.id === node.id;
                  return (
                    <div
                      key={node.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => void handleSelectNode(node.id)}
                        style={{
                          ...sidebarItemStyle(isActive),
                          width: "auto",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <span style={sidebarBadgeStyle("ssh")}>SSH</span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {nodeLabel(node)}
                        </span>
                      </button>
                      <button
                        type="button"
                        title={`Delete ${nodeLabel(node)}`}
                        onClick={(event) => void handleDeleteNode(event, node)}
                        style={{
                          ...appIconButtonStyle(true),
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                        }}
                      >
                        <DeleteRoundedIcon fontSize="small" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: "10px 16px 16px", borderTop: "1px solid var(--td-border-soft)", display: "grid", gap: 8 }}>
              {displayConnectionUrl && (
                <button
                  type="button"
                  title={connectionUrl}
                  onClick={() => setConnectionDialogOpen(true)}
                  style={{
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    border: "1px solid var(--td-border)",
                    borderRadius: 12,
                    padding: "7px 10px",
                    color: "var(--td-text-muted)",
                    background: "color-mix(in srgb, var(--td-surface) 68%, transparent)",
                    fontSize: 12,
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ color: "var(--td-green)" }}>↔</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayConnectionUrl}
                  </span>
                </button>
              )}
              <button type="button" onClick={onThemeToggle} style={sidebarNavStyle}>
                <span style={{ width: 20, textAlign: "center" }}>{isDarkTheme ? "☀" : "☾"}</span>
                Theme
              </button>
              <div style={{ ...sidebarNavStyle, cursor: "default" }}>
                <SettingsRoundedIcon fontSize="small" />
                Settings
              </div>
            </div>
          </aside>
        )}

          <main
            onDragOver={handleWorkbenchDragOver}
            onDragLeave={() => setIsWorkbenchDragOver(false)}
            onDrop={handleWorkbenchDrop}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
              outline: isWorkbenchDragOver ? "2px solid var(--td-blue)" : "none",
              outlineOffset: -2,
              background: isWorkbenchDragOver ? "var(--td-active)" : "var(--td-surface)",
            }}
          >
            {isWorkbenchDragOver && (
              <div
                style={{
                  position: "absolute",
                  inset: 12,
                  zIndex: 20,
                  display: "grid",
                  placeItems: "center",
                  pointerEvents: "none",
                  border: "2px dashed var(--td-blue)",
                  borderRadius: 8,
                  background: isDarkTheme ? "rgba(9,13,20,0.78)" : "rgba(255,255,255,0.78)",
                  color: "var(--td-blue)",
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                Drop app here to edit and start
              </div>
            )}
            <div
              style={{
                height: 30,
                borderBottom: "1px solid var(--td-border)",
                display: "flex",
                alignItems: "center",
                background: "var(--td-surface-2)",
                overflowX: "auto",
              }}
            >
              {appNodes.length === 0 ? (
                <span style={{ padding: "6px 12px", color: "var(--td-text-muted)", fontSize: 14 }}>No app</span>
              ) : (
                appNodes.map((node) => {
                  const isActive = selectedFlowNode?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => void handleSelectNode(node.id)}
                      title={nodeLabel(node)}
                      style={{
                        minWidth: 112,
                        maxWidth: 180,
                        height: "100%",
                        padding: "0 12px",
                        border: "none",
                        borderRight: "1px solid var(--td-border)",
                        borderBottom: isActive ? "2px solid var(--td-blue)" : "2px solid transparent",
                        background: isActive ? "var(--td-surface)" : "transparent",
                        color: isActive ? "var(--td-text-strong)" : "var(--td-text-muted)",
                        fontSize: 14,
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "center",
                      }}
                    >
                      {nodeLabel(node)}
                    </button>
                  );
                })
              )}
            </div>

            {graphLoading ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--td-text-muted)" }}>
                Loading graph...
              </div>
            ) : graphError ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#c62828", padding: 24 }}>
                {graphError}
              </div>
            ) : (
              <>
                <div
                  style={{
                    minHeight: 46,
                    borderBottom: "1px solid var(--td-border)",
                    background: "var(--td-surface)",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 8px",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      border: "1px solid var(--td-input-border)",
                      color: "#62a35b",
                      borderRadius: 4,
                      fontSize: 11,
                      padding: "0 2px",
                      background: "var(--td-input-bg)",
                    }}
                  >
                    {selectedFlowNode?.type === "directssh" ? "SSH" : "APP"}
                  </span>
                  {selectedFlowNode?.type === "app" ? (
                    <input
                      value={selectedFlowNode.data.readableNodeId ?? ""}
                      onChange={(event) =>
                        handleUpdateNode(selectedFlowNode.id, {
                          readableNodeId: event.target.value,
                        })
                      }
                      title="App name"
                      style={{
                        width: "min(220px, 30vw)",
                        height: 30,
                        border: "1px solid transparent",
                        borderRadius: 4,
                        padding: "0 6px",
                        background: "transparent",
                        color: "var(--td-text-strong)",
                        fontSize: 14,
                        fontWeight: 750,
                        outline: "none",
                      }}
                      onFocus={(event) => {
                        event.currentTarget.style.borderColor = "var(--td-input-border)";
                        event.currentTarget.style.background = "var(--td-input-bg)";
                      }}
                      onBlur={(event) => {
                        event.currentTarget.style.borderColor = "transparent";
                        event.currentTarget.style.background = "transparent";
                      }}
                    />
                  ) : (
                    <strong style={{ fontSize: 14, color: "var(--td-text-strong)" }}>{selectedFlowTitle}</strong>
                  )}
                  <div style={{ flex: 1 }} />
                  {selectedFlowNode && (
                    <>
                      {selectedFlowNode.type === "app" ? (
                        <select
                          value={selectedAppDriver}
                          onChange={(event) =>
                            handleUpdateNode(selectedFlowNode.id, { driver: event.target.value })
                          }
                          title="Select SSH driver"
                          style={{
                            maxWidth: 180,
                            height: 30,
                            border: "none",
                            borderRadius: 16,
                            background: selectedAppIsRunning ? "#3f823c" : "#8b949e",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "0 10px",
                            outline: "none",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">No SSH</option>
                          {selectedAppDriver && !selectedDriverNode && (
                            <option value={selectedAppDriver}>{selectedAppDriver}</option>
                          )}
                          {sshNodes.map((sshNode) => (
                            <option key={sshNode.id} value={sshNode.id}>
                              {nodeLabel(sshNode)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          style={{
                            borderRadius: 14,
                            background: "#8b949e",
                            color: "#fff",
                            fontSize: 12,
                            padding: "5px 10px",
                          }}
                        >
                          SSH settings
                        </span>
                      )}
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <button
                          type="button"
                          onClick={selectedAppIsRunning ? undefined : handleStartNode}
                          disabled={selectedFlowNode.type !== "app"}
                          title={selectedAppIsRunning ? "App running" : "Start app"}
                          style={appIconButtonStyle(selectedFlowNode.type === "app" && !selectedAppIsRunning)}
                        >
                          {selectedAppIsRunning ? (
                            <PauseRoundedIcon fontSize="small" />
                          ) : (
                            <PlayArrowRoundedIcon fontSize="small" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleStopNode}
                          disabled={selectedFlowNode.type !== "app" || !selectedAppIsRunning}
                          title="Stop app"
                          style={appIconButtonStyle(selectedFlowNode.type === "app" && selectedAppIsRunning)}
                        >
                          <StopRoundedIcon fontSize="small" />
                        </button>
                        <button
                          type="button"
                          onClick={handleStopSession}
                          disabled={selectedFlowNode.type !== "app"}
                          title="Stop app session"
                          style={appIconButtonStyle(selectedFlowNode.type === "app")}
                        >
                          <DeleteRoundedIcon fontSize="small" />
                        </button>
                        <button
                          type="button"
                          onClick={handleFullscreenApp}
                          title={isWorkspaceFullscreen ? "Exit full screen app" : "Full screen app"}
                          style={appIconButtonStyle(true)}
                        >
                          {isWorkspaceFullscreen ? (
                            <FullscreenExitRoundedIcon fontSize="small" />
                          ) : (
                            <FullscreenRoundedIcon fontSize="small" />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {editingSshNode ? (
                  <div
                    style={{
                      flex: 1,
                      overflow: "auto",
                      padding: "22px 26px",
                      background: "var(--td-surface)",
                      fontFamily: "Inter, system-ui, sans-serif",
                    }}
                  >
                    <div style={{ maxWidth: 760 }}>
                      <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700, color: "var(--td-text-strong)" }}>
                        SSH Settings
                      </h2>
                      <p style={{ margin: "0 0 22px", color: "var(--td-text-muted)", fontSize: 13 }}>
                        Configure the SSH driver used by apps in this flow.
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <label>
                          <span style={fieldLabelStyle}>Name</span>
                          <input
                            value={editingSshNode.data.readableNodeId ?? ""}
                            onChange={(event) =>
                              handleUpdateNode(editingSshNode.id, { readableNodeId: event.target.value })
                            }
                            style={fieldInputStyle}
                          />
                        </label>
                        <label>
                          <span style={fieldLabelStyle}>Host / URL</span>
                          <input
                            value={editingSshNode.data.url ?? ""}
                            onChange={(event) =>
                              handleUpdateNode(editingSshNode.id, { url: event.target.value })
                            }
                            placeholder="host:port"
                            style={fieldInputStyle}
                          />
                        </label>
                        <label>
                          <span style={fieldLabelStyle}>Username</span>
                          <input
                            value={editingSshNode.data.username ?? ""}
                            onChange={(event) =>
                              handleUpdateNode(editingSshNode.id, { username: event.target.value })
                            }
                            style={fieldInputStyle}
                          />
                        </label>
                        <label>
                          <span style={fieldLabelStyle}>Password / Secret</span>
                          <input
                            type="password"
                            value={editingSshNode.data.password ?? ""}
                            onChange={(event) =>
                              handleUpdateNode(editingSshNode.id, { password: event.target.value })
                            }
                            style={fieldInputStyle}
                          />
                        </label>
                      </div>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          margin: "18px 0",
                          color: "var(--td-text)",
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(editingSshNode.data.enablePortForward)}
                          onChange={(event) =>
                            handleUpdateNode(editingSshNode.id, {
                              enablePortForward: event.target.checked,
                            })
                          }
                        />
                        Enable port forwarding
                      </label>
                      <label style={{ display: "block" }}>
                        <span style={fieldLabelStyle}>Init Commands</span>
                        <textarea
                          value={editingSshNode.data.initCommands ?? ""}
                          onChange={(event) =>
                            handleUpdateNode(editingSshNode.id, { initCommands: event.target.value })
                          }
                          rows={8}
                          style={{ ...fieldInputStyle, resize: "vertical", fontFamily: "Menlo, Monaco, Consolas, monospace" }}
                        />
                      </label>
                    </div>
                  </div>
                ) : selectedAppHasRuntime ? (
                  <div
                    ref={appRuntimeRef}
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflow: "hidden",
                      background: "var(--td-surface)",
                      position: "relative",
                    }}
                  >
                    {appLayout && <LayoutRoot layout={appLayout} />}
                  </div>
                ) : (
                  <>
                <div style={{ padding: "20px 10px 8px", color: "var(--td-text-muted)", fontSize: 16 }}>
                  Module Id
                </div>
                <div style={{ display: "flex", padding: "0 6px 4px", gap: 6 }}>
                  <select
                    value={selectedTemplateLabel}
                    onChange={(event) => applyTemplate(event.target.value)}
                    style={{
                      flex: 1,
                      height: 38,
                      border: "1px solid var(--td-input-border)",
                      borderRadius: 4,
                      background: "var(--td-input-bg)",
                      color: "var(--td-text)",
                      padding: "0 12px",
                      fontSize: 16,
                    }}
                  >
                    <option value="">App Template</option>
                    {appTemplates.map((template) => (
                      <option key={template.label} value={template.label}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveGraph}
                    disabled={!selectedFlowNode || selectedFlowNode.type !== "app"}
                    style={{
                      width: 74,
                      border: "1px solid var(--td-blue)",
                      borderRadius: 4,
                      background: "var(--td-input-bg)",
                      color: "var(--td-blue)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: selectedFlowNode?.type === "app" ? "pointer" : "default",
                    }}
                  >
                    LOAD
                  </button>
                </div>
                <div style={{ display: "flex", padding: "0 6px 4px" }}>
                  <input
                    value={selectedFlowNode?.data.module ?? ""}
                    onChange={(event) =>
                      selectedFlowNode && handleUpdateNode(selectedFlowNode.id, { module: event.target.value })
                    }
                    placeholder="Module Id"
                    style={{
                      width: "100%",
                      height: 32,
                      border: "1px solid var(--td-input-border)",
                      borderRadius: 3,
                      padding: "0 10px",
                      color: "var(--td-text)",
                      background: "var(--td-input-bg)",
                      fontSize: 14,
                    }}
                  />
                </div>
                <div style={{ flex: 1, minHeight: 0, borderTop: "1px solid var(--td-border)" }}>
                  <Editor
                    value={selectedFlowCode}
                    language={selectedFlowNode?.type === "app" ? "python" : "json"}
                    theme={isDarkTheme ? "vs-dark" : "vs"}
                    onChange={(value) => {
                      if (!selectedFlowNode) return;
                      if (selectedFlowNode.type === "app") {
                        handleUpdateNode(selectedFlowNode.id, { initCode: value ?? "" });
                      } else {
                        handleUpdateNode(selectedFlowNode.id, { initConfig: value ?? "" });
                      }
                    }}
                    options={{
                      automaticLayout: true,
                      minimap: { enabled: true, side: "right", renderCharacters: false },
                      fontSize: 13,
                      lineHeight: 20,
                      fontFamily: "Menlo, Monaco, Consolas, monospace",
                      scrollBeyondLastLine: false,
                      lineNumbersMinChars: 3,
                      tabSize: 4,
                      insertSpaces: true,
                      wordWrap: "off",
                      renderWhitespace: "selection",
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
                  </>
                )}
              </>
            )}
          </main>
        </div>
      {connectionDialogOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConnectionDialogOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            background: "rgba(0, 0, 0, 0.48)",
          }}
        >
          <form
            onSubmit={handleApplyConnection}
            style={{
              width: "min(420px, calc(100vw - 32px))",
              border: "1px solid var(--td-border)",
              borderRadius: 8,
              padding: 18,
              background: "var(--td-surface)",
              color: "var(--td-text)",
              boxShadow: "0 18px 55px rgba(0, 0, 0, 0.36)",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  color: "var(--td-text-strong)",
                  fontSize: 16,
                  fontWeight: 750,
                  lineHeight: 1.2,
                }}
              >
                WebSocket
              </div>
              <div
                style={{
                  marginTop: 5,
                  color: "var(--td-text-muted)",
                  fontFamily: "Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {buildConnectionUrl(connectionDraft).replace("/api/ws/", "/").replace("127.0.0.1", "localhost")}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 108px", gap: 10 }}>
              <label>
                <span style={fieldLabelStyle}>Host</span>
                <input
                  value={connectionDraft.host}
                  onChange={(event) =>
                    setConnectionDraft((current) => ({ ...current, host: event.target.value }))
                  }
                  style={fieldInputStyle}
                />
              </label>
              <label>
                <span style={fieldLabelStyle}>Port</span>
                <input
                  inputMode="numeric"
                  value={connectionDraft.port}
                  onChange={(event) =>
                    setConnectionDraft((current) => ({ ...current, port: event.target.value }))
                  }
                  style={fieldInputStyle}
                />
              </label>
            </div>
            <label style={{ display: "block", marginTop: 12 }}>
              <span style={fieldLabelStyle}>Path</span>
              <input
                value={connectionDraft.path}
                onChange={(event) =>
                  setConnectionDraft((current) => ({ ...current, path: event.target.value }))
                }
                style={fieldInputStyle}
              />
            </label>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 18,
              }}
            >
              <button
                type="button"
                onClick={() => setConnectionDialogOpen(false)}
                style={{
                  height: 34,
                  padding: "0 14px",
                  border: "1px solid var(--td-border)",
                  borderRadius: 4,
                  background: "transparent",
                  color: "var(--td-text)",
                  cursor: "pointer",
                  fontWeight: 650,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  height: 34,
                  padding: "0 16px",
                  border: "1px solid var(--td-blue)",
                  borderRadius: 4,
                  background: "var(--td-blue)",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 750,
                }}
              >
                Apply
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Status bar */}
      {statusMsg && (
        <div style={{
          padding: "4px 12px",
          backgroundColor: "#1a3a1a",
          borderTop: "1px solid #2a5a2a",
          color: "#4caf50",
          fontSize: 11,
          flexShrink: 0,
        }}>
          {statusMsg}
        </div>
      )}
    </div>
  );
}
