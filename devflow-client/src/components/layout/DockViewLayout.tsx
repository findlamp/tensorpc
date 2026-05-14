import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import Close from "@mui/icons-material/Close";
import { useSendEvent } from "../../hooks/useSendEvent";
import { FrontendEventType } from "../../core/socketTypes";
import { childUids } from "../../utils/helpers";
import type { ComponentProps } from "../../hooks/useLayoutModel";

export const DND_MIME = "application/x-tensorpc-dnd";

type TensorpcDragPayload = {
  dragType?: string;
  dragData?: Record<string, unknown>;
};

declare global {
  interface Window {
    __tensorpcLastDragPayload?: TensorpcDragPayload;
  }
}

function safeParseDragPayload(event: DragEvent<HTMLElement>): TensorpcDragPayload | null {
  const raw =
    event.dataTransfer.getData(DND_MIME) ||
    event.dataTransfer.getData("text/plain");
  if (!raw) return window.__tensorpcLastDragPayload ?? null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as TensorpcDragPayload;
  } catch {
    return window.__tensorpcLastDragPayload ?? null;
  }
}

function hasTensorpcDragPayload(event: DragEvent<HTMLElement>) {
  const types = Array.from(event.dataTransfer.types);
  return types.includes(DND_MIME) || types.includes("text/plain") || !!window.__tensorpcLastDragPayload;
}

function tabLabelFromChildUid(uid: string, index: number) {
  const compactRaw = uid
    .split(".")
    .at(-1)
    ?.replace(/^.*\|/, "")
    .trim();
  const compact = compactRaw
    ?.replace(/-(ctrl|terminal|control|debug-panel)(?:-[a-z0-9]+)?$/i, " ($1)")
    .replace(/_/g, " ");
  return compact || `Session ${index + 1}`;
}

function isGeneratedPanelId(uid: string) {
  return uid
    .split(".")
    .some((part) => part.startsWith("Panel-") || part.includes("|Panel-"));
}

function stableTabId(name: unknown) {
  const base =
    typeof name === "string" && name.trim()
      ? name.trim()
      : `session-${Date.now().toString(36)}`;
  return base.replace(/[^a-zA-Z0-9_.:-]+/g, "-");
}

type TaskGroupLabel = {
  groupName: string;
  clusterName: string;
  label: string;
  tabName: string;
  tabId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function taskGroupLabels(layout: Record<string, ComponentProps>): TaskGroupLabel[] {
  const visited = new Set<unknown>();

  for (const node of Object.values(layout)) {
    const fromNode = collectTaskGroupLabels(node, visited);
    if (fromNode.length > 0) return fromNode;
  }

  for (const node of Object.values(layout)) {
    const dataList = node.props?.dataList;
    if (Array.isArray(dataList) && dataList.some((item) => isRecord(item) && "dragData" in item)) {
      return dataList.filter(isRecord).map(taskGroupLabelFromRecord);
    }
  }
  for (const node of Object.values(layout)) {
    const dataObject = node.props?.dataObject;
    if (!isRecord(dataObject) || !Array.isArray(dataObject.task_groups)) continue;
    return dataObject.task_groups.filter(isRecord).map(taskGroupLabelFromRecord);
  }
  return [];
}

function collectTaskGroupLabels(
  value: unknown,
  visited: Set<unknown>,
  depth = 0,
): TaskGroupLabel[] {
  if (depth > 8 || value === null || value === undefined) return [];
  if (typeof value !== "object") return [];
  if (visited.has(value)) return [];
  visited.add(value);

  if (Array.isArray(value)) {
    const taskGroups = value.filter(isTaskGroupRecord);
    if (taskGroups.length > 0) {
      return taskGroups.map(taskGroupLabelFromRecord);
    }
    for (const item of value) {
      const nested = collectTaskGroupLabels(item, visited, depth + 1);
      if (nested.length > 0) return nested;
    }
    return [];
  }

  const record = value as Record<string, unknown>;
  if (isTaskGroupRecord(record)) return [taskGroupLabelFromRecord(record)];

  const prioritized = [
    recordValue(record, "task_groups"),
    recordValue(record, "taskGroups"),
    recordValue(record, "dataList"),
    recordValue(record, "dataObject"),
    recordValue(record, "props"),
  ];
  for (const item of prioritized) {
    const nested = collectTaskGroupLabels(item, visited, depth + 1);
    if (nested.length > 0) return nested;
  }

  for (const item of Object.values(record)) {
    const nested = collectTaskGroupLabels(item, visited, depth + 1);
    if (nested.length > 0) return nested;
  }
  return [];
}

function recordValue(value: Record<string, unknown>, key: string) {
  return value[key];
}

function isTaskGroupRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const dragData = value.dragData;
  const hasTaskGroupName =
    typeof value.group_name === "string" ||
    typeof value.group_id === "string" ||
    (isRecord(dragData) &&
      (typeof dragData.group_id === "string" || typeof dragData.name === "string"));
  return hasTaskGroupName && isRecord(dragData) && "url_with_port" in dragData;
}

function taskGroupLabelFromRecord(group: Record<string, unknown>): TaskGroupLabel {
  const groupName = String(group.group_name ?? group.group_id ?? "");
  const clusterName = String(group.cluster_name ?? group.cluster_id ?? "");
  const dragData = isRecord(group.dragData) ? group.dragData : {};
  const tabName =
    typeof dragData.name === "string" && dragData.name.length > 0
      ? dragData.name
      : `${groupName} (ctrl)`;
  return {
    groupName,
    clusterName,
    tabName,
    tabId: stableTabId(tabName),
    label: groupName && clusterName ? `${groupName}@${clusterName}` : tabName,
  };
}

function dragDataValue(data: Record<string, unknown>, key: unknown) {
  if (typeof key !== "string" || key.length === 0) return undefined;
  const value = data[key];
  if (typeof value === "string" || typeof value === "number") return String(value);
  return undefined;
}

function dropPanelLabel(dragData: Record<string, unknown>, fallback: string | undefined) {
  const groupName = dragDataValue(dragData, "group_name") ?? dragDataValue(dragData, "group_id");
  const clusterName = dragDataValue(dragData, "cluster_name") ?? dragDataValue(dragData, "cluster_id");
  if (groupName && clusterName) return `${groupName}@${clusterName}`;
  return fallback;
}

type PendingPane = {
  id: string;
  label: string;
  dragData: Record<string, unknown>;
  visibleCountAtCreate: number;
  failed?: boolean;
};

function childMatchesPending(childId: string, pane: PendingPane) {
  if (childId === pane.id || childId.endsWith(pane.id) || childId.includes(pane.id)) return true;
  const groupId = dragDataValue(pane.dragData, "group_id");
  if (groupId && (childId.includes(groupId) || childId.includes(stableTabId(groupId)))) return true;
  const name = dragDataValue(pane.dragData, "name");
  if (name && (childId.includes(name) || childId.includes(stableTabId(name)))) return true;
  return false;
}

function tabKeyFromChildId(childId: string) {
  const lastPart = childId.split(".").at(-1) ?? childId;
  return lastPart.replace(/^.*\|/, "");
}

function childMatchesClosedId(childId: string, closedId: string) {
  if (!closedId) return false;
  const childKey = tabKeyFromChildId(childId);
  const closedKey = tabKeyFromChildId(closedId);
  return (
    childId === closedId ||
    childId === closedKey ||
    childKey === closedId ||
    childKey === closedKey ||
    childId.endsWith(closedKey) ||
    closedId.endsWith(childKey)
  );
}

function shouldHideClosedChild(childId: string, closedIds: Set<string>) {
  for (const closedId of closedIds) {
    if (childMatchesClosedId(childId, closedId)) return true;
  }
  return false;
}

function clearClosedForPane(
  closedIds: Set<string>,
  tabId: string,
  dragData: Record<string, unknown>,
) {
  if (closedIds.size === 0) return closedIds;
  const pane: PendingPane = {
    id: tabId,
    label: "",
    dragData,
    visibleCountAtCreate: 0,
  };
  const next = new Set(
    [...closedIds].filter(
      (closedId) =>
        !childMatchesClosedId(tabId, closedId) &&
        !childMatchesPending(closedId, pane),
    ),
  );
  return next.size === closedIds.size ? closedIds : next;
}

function deleteMatchingKey<T>(record: Record<string, T>, key: string) {
  const matching = Object.keys(record).filter((candidate) => childMatchesClosedId(candidate, key));
  if (matching.length === 0) return record;
  const next = { ...record };
  matching.forEach((candidate) => {
    delete next[candidate];
  });
  return next;
}

function panelLabel(
  childId: string,
  index: number,
  pendingTabLabels: Record<string, string>,
  groups: TaskGroupLabel[],
  domGroupLabels: string[],
) {
  if (pendingTabLabels[childId]) return pendingTabLabels[childId];
  const matchedKey = Object.keys(pendingTabLabels).find(
    (key) => childId === key || childId.endsWith(key) || childId.includes(key),
  );
  if (matchedKey) return pendingTabLabels[matchedKey];
  const matchedGroup = groups.find(
    (group) =>
      childId === group.tabId ||
      childId.endsWith(group.tabId) ||
      (group.groupName !== "" &&
        (childId.includes(group.groupName) ||
          childId.includes(stableTabId(group.groupName)))),
  );
  if (matchedGroup) return matchedGroup.label;
  if (isGeneratedPanelId(childId) && domGroupLabels[index]) return domGroupLabels[index];
  if (isGeneratedPanelId(childId) && groups[index]) return groups[index].label;
  return tabLabelFromChildUid(childId, index);
}

export function DockViewLayout({
  props,
  layout,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
  children: ReactNode[];
}) {
  const sendEvent = useSendEvent();
  const compUid = typeof props.compUid === "string" ? props.compUid : "";
  const allowedDndTypes = Array.isArray(props.allowedDndTypes)
    ? props.allowedDndTypes.map(String)
    : [];
  const childIds = useMemo(() => childUids(props), [props]);
  const groups = useMemo(() => taskGroupLabels(layout), [layout]);
  const [dropActive, setDropActive] = useState(false);
  const [pendingTabLabels, setPendingTabLabels] = useState<Record<string, string>>({});
  const [pendingPanes, setPendingPanes] = useState<Record<string, PendingPane>>({});
  const [domGroupLabels, setDomGroupLabels] = useState<string[]>([]);
  const [closedChildIds, setClosedChildIds] = useState<Set<string>>(() => new Set());

  const visibleChildren = useMemo(
    () =>
      children.filter(
        (child, index) =>
          Boolean(child) && !shouldHideClosedChild(childIds[index] ?? "", closedChildIds),
      ),
    [childIds, children, closedChildIds],
  );
  const visibleChildIds = useMemo(
    () =>
      childIds.filter(
        (uid, index) => Boolean(children[index]) && !shouldHideClosedChild(uid, closedChildIds),
      ),
    [childIds, children, closedChildIds],
  );

  useEffect(() => {
    setClosedChildIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(
        [...prev].filter((closedId) =>
          childIds.some((childId) => childMatchesClosedId(childId, closedId)),
        ),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [childIds]);

  useEffect(() => {
    const readLabels = () => {
      const labels = Array.from(
        document.querySelectorAll<HTMLElement>("[data-tensorpc-cm-task-group-label]"),
      )
        .map((node) => node.dataset.tensorpcCmTaskGroupLabel ?? "")
        .filter(Boolean);
      setDomGroupLabels((prev) =>
        prev.length === labels.length && prev.every((label, index) => label === labels[index])
          ? prev
          : labels,
      );
    };
    readLabels();
    const observer = new MutationObserver(readLabels);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-tensorpc-cm-task-group-label"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visibleChildIds.length === 0) return;
    const resolved = Object.entries(pendingPanes)
      .map(([paneId, pane]) => {
        const childId =
          visibleChildIds.find((candidate) => childMatchesPending(candidate, pane)) ??
          (visibleChildIds.length > pane.visibleCountAtCreate
            ? visibleChildIds[pane.visibleCountAtCreate] ?? visibleChildIds.at(-1)
            : undefined);
        return childId ? { paneId, childId, label: pane.label } : undefined;
      })
      .filter(Boolean) as Array<{ paneId: string; childId: string; label: string }>;
    if (resolved.length === 0) return;

    setPendingPanes((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of resolved) {
        if (next[item.paneId]) {
          delete next[item.paneId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setPendingTabLabels((prev) => ({
      ...prev,
      ...Object.fromEntries(resolved.map((item) => [item.childId, item.label])),
    }));
  }, [pendingPanes, visibleChildIds]);

  const openDragPayload = useCallback(
    (payload: TensorpcDragPayload | null) => {
      if (!payload || !compUid) return false;
      if (
        allowedDndTypes.length > 0 &&
        payload.dragType &&
        !allowedDndTypes.includes(payload.dragType)
      ) {
        return false;
      }
      const dragData = payload.dragData ?? {};
      const tabName = dragDataValue(dragData, props.tabNameKey) ?? dragDataValue(dragData, "name");
      const tabId = dragDataValue(dragData, props.tabIdKey) ?? stableTabId(tabName);
      const label = dropPanelLabel(dragData, tabName) ?? tabId;
      setClosedChildIds((prev) => clearClosedForPane(prev, tabId, dragData));
      setPendingTabLabels((prev) => ({ ...prev, [tabId]: label }));
      setPendingPanes((prev) =>
        prev[tabId]
          ? {
              ...prev,
              [tabId]: {
                ...prev[tabId],
                label,
                dragData,
                visibleCountAtCreate: visibleChildIds.length,
                failed: false,
              },
            }
          : {
              ...prev,
              [tabId]: {
                id: tabId,
                label,
                dragData,
                visibleCountAtCreate: visibleChildIds.length,
              },
            },
      );
      void sendEvent(compUid, FrontendEventType.Drop, {
        noCollect: true,
        dragType: payload.dragType,
        complexLayoutTabNodeId: tabId,
        dragData,
      }).then((ok) => {
        if (ok) return;
        setPendingPanes((prev) =>
          prev[tabId] ? { ...prev, [tabId]: { ...prev[tabId], failed: true } } : prev,
        );
      });
      return true;
    },
    [allowedDndTypes, compUid, props.tabIdKey, props.tabNameKey, sendEvent, visibleChildIds.length],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<TensorpcDragPayload>).detail;
      void openDragPayload(detail ?? null);
    };
    window.addEventListener("tensorpc-cm-task-group-open", handler);
    return () => window.removeEventListener("tensorpc-cm-task-group-open", handler);
  }, [openDragPayload]);

  const pendingToRender = Object.values(pendingPanes).filter(
    (pane) => !visibleChildIds.some((childId) => childMatchesPending(childId, pane)),
  );
  const hasWorkspaceContent = visibleChildren.length > 0 || pendingToRender.length > 0;

  useEffect(() => {
    let raf = 0;
    let secondRaf = 0;
    const notifyResize = () => window.dispatchEvent(new Event("resize"));
    raf = requestAnimationFrame(() => {
      notifyResize();
      secondRaf = requestAnimationFrame(notifyResize);
    });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (secondRaf) cancelAnimationFrame(secondRaf);
    };
  }, [visibleChildren.length, pendingToRender.length]);

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!hasTensorpcDragPayload(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropActive(true);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    const payload = safeParseDragPayload(event);
    setDropActive(false);
    if (!payload) return;
    if (openDragPayload(payload)) event.preventDefault();
  };

  const closePane = (childId: string) => {
    if (!childId) return;
    const tabKey = tabKeyFromChildId(childId);
    setClosedChildIds((prev) => new Set(prev).add(tabKey));
    setPendingTabLabels((prev) => deleteMatchingKey(prev, tabKey));
    setPendingPanes((prev) => deleteMatchingKey(prev, tabKey));
    void sendEvent(compUid, FrontendEventType.ComplexLayoutCloseTab, { id: tabKey });
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };

  return (
    <section
      data-tensorpc-dock-view=""
      data-tensorpc-drop-active={dropActive ? "true" : "false"}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        ) {
          return;
        }
        setDropActive(false);
      }}
      onDrop={handleDrop}
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--td-surface)",
        outline: dropActive ? "2px solid var(--td-blue)" : "none",
        outlineOffset: -2,
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "stretch",
          gap: 4,
          padding: hasWorkspaceContent || dropActive ? 4 : 0,
          background: "var(--td-surface)",
        }}
      >
        {!hasWorkspaceContent ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "var(--td-text-muted)",
              fontSize: 13,
            }}
          >
            Drag a task group from the cluster list to open its remote panel.
          </div>
        ) : null}
        {visibleChildren.map((child, index) => {
          const childId = visibleChildIds[index] ?? "";
          const label = panelLabel(childId, index, pendingTabLabels, groups, domGroupLabels);
          return (
            <div
              key={childId || index}
              data-tensorpc-dock-workspace-pane=""
              style={{
                flex: "1 1 0",
                minWidth: 0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                border: "1px solid var(--td-border)",
                background: "var(--td-surface)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
              }}
            >
              <div
                style={{
                  height: 28,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 8px",
                  borderBottom: "1px solid var(--td-border)",
                  background: "var(--td-surface-2)",
                  color: "var(--td-text-muted)",
                  fontSize: 12,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={label}
                >
                  {label}
                </span>
                <button
                  type="button"
                  title="Close panel"
                  aria-label={`Close ${label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    closePane(childId);
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    flex: "0 0 auto",
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                    border: "none",
                    borderRadius: 3,
                    background: "transparent",
                    color: "var(--td-text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <Close style={{ fontSize: 16 }} />
                </button>
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  display: "flex",
                  overflow: "hidden",
                }}
              >
              {child}
              </div>
            </div>
          );
        })}
        {pendingToRender.map((pane) => (
          <div
            key={`pending-${pane.id}`}
            data-tensorpc-dock-workspace-pane=""
            style={{
              flex: "1 1 0",
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid var(--td-border)",
              background: "var(--td-surface)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              style={{
                height: 28,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 8px",
                borderBottom: "1px solid var(--td-border)",
                background: "var(--td-surface-2)",
                color: "var(--td-text-muted)",
                fontSize: 12,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={pane.label}
              >
                {pane.label}
              </span>
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: "grid",
                placeItems: "center",
                color: pane.failed ? "var(--td-danger, #ef5350)" : "var(--td-text-muted)",
                fontSize: 13,
              }}
            >
              {pane.failed ? "Remote panel failed to open." : "Loading remote panel..."}
            </div>
          </div>
        ))}
        {dropActive ? (
          <div
            data-tensorpc-dock-drop-preview=""
            style={{
              flex: visibleChildren.length > 0 ? "1 1 0" : "1 1 auto",
              minWidth: visibleChildren.length > 0 ? 220 : 0,
              minHeight: 0,
              border: "2px dashed var(--td-blue)",
              background: "color-mix(in srgb, var(--td-blue), transparent 78%)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--td-blue), transparent 45%)",
              display: "grid",
              placeItems: "center",
              color: "var(--td-text-muted)",
              fontSize: 13,
              pointerEvents: "none",
            }}
          >
            Drop to open workspace
          </div>
        ) : null}
      </div>
    </section>
  );
}
