import type { DragEventHandler, MouseEventHandler, ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";
import type { ComponentProps } from "../../hooks/useLayoutModel";
import { FrontendEventType } from "../../core/socketTypes";
import { UIType } from "../../render/uiTypes";
import { buildParentMap, componentChildUids } from "../../utils/dataModelBindings";
import { lookupLayoutNode, normalizeLayoutUid } from "../../utils/layoutRefs";
import { DND_MIME } from "../layout/DockViewLayout";
import { renderIcon } from "../display/Icon";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function childUid(props: Record<string, unknown>) {
  const childs = props.childs;
  if (!Array.isArray(childs) || childs.length === 0) return undefined;
  return typeof childs[0] === "string" ? childs[0] : String(childs[0]);
}

function findDescendantUid(
  layout: Record<string, ComponentProps>,
  uid: string | undefined,
  predicate: (node: ComponentProps) => boolean,
  seen = new Set<string>(),
): string | undefined {
  if (!uid || seen.has(uid)) return undefined;
  seen.add(uid);
  const node = lookupLayoutNode(layout, uid);
  if (!node) return undefined;
  if (predicate(node)) return String(node.uid ?? uid);
  for (const child of componentChildUids(node)) {
    const found = findDescendantUid(layout, child, predicate, seen);
    if (found) return found;
  }
  return undefined;
}

function nearestDataModel(
  layout: Record<string, ComponentProps>,
  uid: string | undefined,
) {
  if (!uid) return undefined;
  const parents = buildParentMap(layout);
  let cursor: string | undefined = normalizeLayoutUid(uid);
  while (cursor) {
    const node = lookupLayoutNode(layout, cursor);
    if (node?.type === UIType.DataModel) return node;
    cursor = parents.get(cursor);
  }
  return undefined;
}

function tabValueForDescendant(
  layout: Record<string, ComponentProps>,
  uid: string | undefined,
) {
  if (!uid) return undefined;
  const parents = buildParentMap(layout);
  let childUid = normalizeLayoutUid(uid);
  let cursor = parents.get(childUid);
  while (cursor) {
    const node = lookupLayoutNode(layout, cursor);
    if (node?.type === UIType.Tabs) {
      const complex = node.props?.childsComplex;
      if (complex && typeof complex === "object") {
        const tabDefs = (complex as Record<string, unknown>).tabDefs;
        if (Array.isArray(tabDefs)) {
          const tabDef = tabDefs.find(
            (item) =>
              isRecord(item) &&
              typeof item.component === "string" &&
              childUid.startsWith(normalizeLayoutUid(item.component)),
          );
          if (isRecord(tabDef) && typeof tabDef.value === "string") return tabDef.value;
        }
      }
    }
    childUid = cursor;
    cursor = parents.get(cursor);
  }
  return undefined;
}

function isStatusRow(row: unknown) {
  return (
    isRecord(row) &&
    ("ssh_status" in row ||
      "sshStatus" in row ||
      "status" in row ||
      typeof row.color === "string")
  );
}

function normalizeStatusValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    return value.toLowerCase();
  }
  return "";
}

function workerStatusColor(item: Record<string, unknown>) {
  const sshStatus = normalizeStatusValue(item.ssh_status ?? item.sshStatus);
  const ftStatus = normalizeStatusValue(item.status);
  const rawColor = typeof item.color === "string" ? item.color.toLowerCase() : "";

  if (
    ftStatus === 1 ||
    ftStatus === 2 ||
    ftStatus === "master_disconnected" ||
    ftStatus === "worker_disconnected"
  ) {
    return "var(--td-red)";
  }
  if (
    sshStatus === 2 ||
    sshStatus === "running"
  ) {
    return "var(--td-green)";
  }
  if (
    sshStatus === 1 ||
    sshStatus === 3 ||
    sshStatus === "disconnected" ||
    sshStatus === "error"
  ) {
    return "var(--td-red)";
  }
  if (sshStatus === 0 || sshStatus === "idle") {
    return "var(--td-blue)";
  }
  if (rawColor === "red" || rawColor === "orange") {
    return "var(--td-red)";
  }
  if (rawColor === "lime" || rawColor === "green") {
    return "var(--td-green)";
  }
  if (rawColor === "blue") {
    return "var(--td-blue)";
  }
  if (rawColor === "gray" || rawColor === "grey") {
    return "var(--td-text-muted)";
  }
  return "var(--td-blue)";
}

function isCmTaskGroup(row: unknown) {
  return (
    isRecord(row) &&
    typeof row.group_name === "string" &&
    typeof row.cluster_name === "string" &&
    isRecord(row.dragData)
  );
}

function isCmCluster(row: unknown) {
  return (
    isRecord(row) &&
    typeof row.provider === "string" &&
    typeof row.name === "string" &&
    "num_nodes" in row &&
    "num_cpu" in row &&
    "num_gpu" in row
  );
}

function stringField(item: Record<string, unknown>, key: string, fallback = "") {
  const value = item[key];
  return typeof value === "string" ? value : fallback;
}

function numberField(item: Record<string, unknown>, key: string) {
  const value = item[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function tagLabels(item: Record<string, unknown>) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return tags
    .map((tag) => (isRecord(tag) && typeof tag.label === "string" ? tag.label : ""))
    .filter(Boolean);
}

function CmCodeValue({ value }: { value: string | number }) {
  return (
    <code
      style={{
        minWidth: 16,
        textAlign: "center",
        borderRadius: 4,
        padding: "0 5px",
        background: "var(--td-surface-3)",
        color: "var(--td-text-strong)",
        fontFamily: "inherit",
        fontSize: "0.92em",
      }}
    >
      {value}
    </code>
  );
}

function CmMetric({ label, value, comma }: { label: string; value: string | number; comma?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
      <CmCodeValue value={value} />
      <span>
        {label}
        {comma ? "," : ""}
      </span>
    </span>
  );
}

function CmDivider() {
  return <div style={{ height: 1, background: "var(--td-border)", flexShrink: 0 }} />;
}

function cmStatusColor(color: string) {
  if (color === "success") return "var(--td-green)";
  if (color === "error") return "var(--td-red)";
  if (color === "warning") return "var(--td-orange)";
  return "var(--td-text)";
}

function CmMetricsLine({
  nodes,
  cpus,
  gpus,
}: {
  nodes: string | number;
  cpus: string | number;
  gpus: string | number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        fontSize: 14,
        lineHeight: 1.35,
        padding: "2px 5px",
      }}
    >
      <CmMetric label="Nodes" value={nodes} comma />
      <CmMetric label="CPUs" value={cpus} comma />
      <CmMetric label="GPUs" value={gpus} />
    </div>
  );
}

function CmCardShell({
  children,
  draggable,
  onDragStart,
  onDragEnd,
  onDoubleClick,
  dataAttrs,
}: {
  children: ReactNode;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  onDoubleClick?: MouseEventHandler<HTMLDivElement>;
  dataAttrs?: Record<string, string>;
}) {
  return (
    <div
      {...dataAttrs}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={onDoubleClick}
      style={{
        border: "1px solid var(--td-border)",
        borderRadius: 3,
        background: "var(--td-surface)",
        color: "var(--td-text)",
        width: "100%",
        flex: "0 0 auto",
        alignSelf: "stretch",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 2px 4px var(--td-shadow)",
        cursor: draggable ? "grab" : "default",
      }}
    >
      {children}
    </div>
  );
}

function CmCardHeader({
  title,
  draggable,
  action,
}: {
  title: string;
  draggable?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: 28,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 6px 2px",
        minWidth: 0,
      }}
    >
      {draggable ? (
        <span
          style={{
            width: 16,
            height: 16,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--td-text)",
            flexShrink: 0,
          }}
        >
          {renderIcon(35, { fontSize: 16, color: "currentColor" })}
        </span>
      ) : null}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 13,
          color: "var(--td-text-strong)",
        }}
      >
        {title}
      </span>
      {action}
    </div>
  );
}

function CmDeleteButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      title="Delete Task Group"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 24,
        height: 24,
        border: 0,
        borderRadius: 3,
        background: "transparent",
        color: "var(--td-text-muted)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {renderIcon(10, { fontSize: 16, color: "currentColor" })}
    </button>
  );
}

function CmFooter({
  status,
  statusColor,
  activity,
}: {
  status: string;
  statusColor: string;
  activity: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        color: "var(--td-text-muted)",
        fontSize: 12,
        lineHeight: 1.3,
        padding: "3px 5px 4px",
      }}
    >
      <span style={{ color: statusColor }}>{status}</span>
      <span>{activity}</span>
    </div>
  );
}

function CmTags({ labels }: { labels: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "4px 5px" }}>
      {(labels.length > 0 ? labels : ["GPU"]).map((label) => (
        <span
          key={label}
          style={{
            borderRadius: 999,
            padding: "2px 10px",
            background: "#4f8f45",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function confirmDelete(node: ComponentProps | undefined) {
  const message = node?.props?.confirmMessage;
  if (typeof message !== "string" || message.length === 0) return true;
  const title = node?.props?.confirmTitle;
  return window.confirm(
    `${typeof title === "string" && title.length > 0 ? `${title}\n\n` : ""}${message}`,
  );
}

function styleValueOr<T>(value: T | undefined, fallback: T) {
  return value === undefined || value === null || value === "" ? fallback : value;
}

export function DataFlexBox({
  props,
  layout,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const isDataListBox = Array.isArray(props.dataList);
  const dataList = isDataListBox ? (props.dataList as unknown[]) : [];
  const templateUid = childUid(props);
  const dmData = nearestDataModel(layout, typeof props.compUid === "string" ? props.compUid : undefined)
    ?.props?.dataObject;
  const tabValue = tabValueForDescendant(
    layout,
    typeof props.compUid === "string" ? props.compUid : undefined,
  );
  const cmTaskGroups =
    dataList.some(isCmTaskGroup)
      ? dataList
      : isRecord(dmData) && tabValue === "group" && Array.isArray(dmData.task_groups)
        ? dmData.task_groups
        : [];
  const cmClusters =
    dataList.some(isCmCluster)
      ? dataList
      : isRecord(dmData) && tabValue === "clusters" && Array.isArray(dmData.clusters)
        ? dmData.clusters
        : [];
  const deleteButtonUid = findDescendantUid(
    layout,
    templateUid,
    (node) => node.type === UIType.IconButton && node.props?.icon === 10,
  );
  const deleteButtonNode = deleteButtonUid ? lookupLayoutNode(layout, deleteButtonUid) : undefined;

  if (cmTaskGroups.length > 0) {
    return (
      <div
        style={{
          ...sx,
          width: sx.width ?? "100%",
          minWidth: sx.minWidth ?? 0,
          minHeight: sx.minHeight ?? 0,
          display: "flex",
          flexDirection: "column",
          flexFlow: "column nowrap",
          flexWrap: "nowrap",
          alignItems: "stretch",
          gap: 10,
          padding: styleValueOr(sx.padding, 5),
          overflowY: sx.overflowY ?? "auto",
          overflowX: sx.overflowX ?? "hidden",
        }}
      >
        {cmTaskGroups.map((row, index) => {
          const item = isRecord(row) ? row : {};
          const id = String(item.id ?? index);
          const groupName = stringField(item, "group_name", "group");
          const clusterName = stringField(item, "cluster_name", "cluster");
          const groupLabel = `${groupName}@${clusterName}`;
          const status = stringField(item, "status", "unknown");
          const color = stringField(item, "color", "inherit");
          const rawDragData = isRecord(item.dragData) ? item.dragData : {};
          const dragData = {
            ...rawDragData,
            name:
              typeof rawDragData.name === "string" && rawDragData.name.length > 0
                ? rawDragData.name
                : `${groupName} (ctrl)`,
            group_id:
              typeof rawDragData.group_id === "string" && rawDragData.group_id.length > 0
                ? rawDragData.group_id
                : groupName,
            group_name: groupName,
            cluster_name: clusterName,
          };
          const dragPayload = {
            dragType: "ClusterPanelTaskGroup",
            dragData,
          };
          return (
            <CmCardShell
              key={id}
              dataAttrs={{
                "data-tensorpc-cm-task-group": id,
                "data-tensorpc-cm-task-group-label": groupLabel,
              }}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                window.__tensorpcLastDragPayload = dragPayload;
                const serialized = JSON.stringify(dragPayload);
                event.dataTransfer.setData(DND_MIME, serialized);
                event.dataTransfer.setData("text/plain", serialized);
              }}
              onDragEnd={() => {
                window.setTimeout(() => {
                  if (window.__tensorpcLastDragPayload === dragPayload) {
                    window.__tensorpcLastDragPayload = undefined;
                  }
                }, 250);
              }}
              onDoubleClick={() => {
                window.dispatchEvent(
                  new CustomEvent("tensorpc-cm-task-group-open", { detail: dragPayload }),
                );
              }}
            >
              <CmCardHeader
                title={groupLabel}
                draggable
                action={
                  <CmDeleteButton
                    disabled={!deleteButtonUid}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!deleteButtonUid) return;
                      if (!confirmDelete(deleteButtonNode)) return;
                      void sendEvent(deleteButtonUid, FrontendEventType.Click, null, id);
                    }}
                  />
                }
              />
              <CmDivider />
              <CmMetricsLine
                nodes={numberField(item, "num_nodes")}
                cpus={numberField(item, "num_cpu")}
                gpus={numberField(item, "num_gpu")}
              />
              <CmDivider />
              <CmTags labels={tagLabels(item)} />
              <CmDivider />
              <CmFooter
                status={status}
                statusColor={cmStatusColor(color)}
                activity={stringField(item, "worker_last_activity")}
              />
            </CmCardShell>
          );
        })}
      </div>
    );
  }

  if (cmClusters.length > 0) {
    return (
      <div
        style={{
          ...sx,
          width: sx.width ?? "100%",
          minWidth: sx.minWidth ?? 0,
          minHeight: sx.minHeight ?? 0,
          display: "flex",
          flexDirection: "column",
          flexFlow: "column nowrap",
          flexWrap: "nowrap",
          alignItems: "stretch",
          gap: 10,
          padding: styleValueOr(sx.padding, 5),
          overflowY: sx.overflowY ?? "auto",
          overflowX: sx.overflowX ?? "hidden",
        }}
      >
        {cmClusters.map((row, index) => {
          const item = isRecord(row) ? row : {};
          const cpuRemain = numberField(item, "num_cpu_remaining");
          const gpuRemain = numberField(item, "num_gpu_remaining");
          return (
            <CmCardShell
              key={String(item.id ?? index)}
              dataAttrs={{ "data-tensorpc-cm-cluster": String(item.id ?? index) }}
            >
              <CmCardHeader title={`${stringField(item, "name")} @ ${stringField(item, "provider")}`} />
              <CmDivider />
              <CmMetricsLine
                nodes={numberField(item, "num_nodes")}
                cpus={`${cpuRemain}/${numberField(item, "num_cpu")}`}
                gpus={`${gpuRemain}/${numberField(item, "num_gpu")}`}
              />
              <CmDivider />
              <CmTags labels={tagLabels(item)} />
            </CmCardShell>
          );
        })}
      </div>
    );
  }

  if (dataList.some(isStatusRow)) {
    return (
      <div
        style={{
          ...sx,
          width: sx.width ?? "100%",
          minWidth: sx.minWidth ?? 0,
          minHeight: sx.minHeight ?? 0,
          display: "flex",
          flexFlow: sx.flexFlow ?? "row wrap",
          padding: sx.padding ?? 10,
          overflow: sx.overflow ?? "hidden",
        }}
      >
        {dataList.map((row, index) => {
          const item = isRecord(row) ? row : {};
          const color = workerStatusColor(item);
          const selected = item.selected === true;
          const active = Number(item.num_bkpt_proc ?? 0) > 0;
          return (
            <button
              key={String(item.id ?? item.uuid ?? item.rank ?? index)}
              type="button"
              title={String(item.label ?? item.ip ?? item.rank ?? index)}
              onClick={() => {
                if (templateUid) sendEvent(templateUid, 0, {}, String(index));
              }}
              style={{
                width: 10,
                height: 10,
                margin: 2,
                padding: 0,
                borderRadius: 1,
                border: selected ? "2px solid lightpink" : "2px solid transparent",
                outline: active ? "1px solid rgba(0, 130, 206, 0.75)" : "none",
                background: color,
                boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height: sx.height ?? (isDataListBox ? undefined : "100%"),
        minWidth: sx.minWidth ?? 0,
        minHeight: sx.minHeight ?? 0,
        flex: sx.flex ?? (isDataListBox ? undefined : 1),
        overflow: sx.overflow ?? "hidden",
      }}
    >
      {children}
    </div>
  );
}
