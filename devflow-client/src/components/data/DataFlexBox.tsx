import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { useSendEvent } from "../../hooks/useSendEvent";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function childUid(props: Record<string, unknown>) {
  const childs = props.childs;
  if (!Array.isArray(childs) || childs.length === 0) return undefined;
  return typeof childs[0] === "string" ? childs[0] : String(childs[0]);
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

export function DataFlexBox({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const isDataListBox = Array.isArray(props.dataList);
  const dataList = isDataListBox ? (props.dataList as unknown[]) : [];
  const templateUid = childUid(props);

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
