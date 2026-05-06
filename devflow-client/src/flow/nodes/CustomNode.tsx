import { type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { FlowNodeData } from "../types";

const nodeStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid #46505f",
  background: "linear-gradient(180deg, #30343d 0%, #252932 100%)",
  color: "#ddd",
  fontSize: 12,
  minWidth: 176,
  fontFamily: "system-ui, sans-serif",
  boxShadow: "0 10px 26px rgba(0, 0, 0, 0.22)",
};

const headerStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 4,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const typeColor: Record<string, string> = {
  directssh: "#4fc3f7",
  command: "#81c784",
  app: "#ce93d8",
  env: "#ffb74d",
  datastorage: "#4db6ac",
  group: "#90a4ae",
  markdown: "#e57373",
  input: "#78909c",
};

const typeIcon: Record<string, string> = {
  directssh: "🖥️",
  command: "⚡",
  app: "📦",
  env: "🔧",
  datastorage: "💾",
  group: "📁",
  markdown: "📝",
  input: "➡️",
};

function nodeColor(type: string) {
  return typeColor[type] || "#888";
}

export function CustomNode({ data, selected }: NodeProps<FlowNodeData>) {
  const d = data;
  const type = (d as unknown as Record<string, unknown>).nodeType as string ?? "";
  const label = d.readableNodeId || d.name || type || "Node";
  const status = (d as unknown as Record<string, unknown>).nodeStatus as string | undefined;

  const borderColor = selected ? "#90caf9" : nodeColor(type);

  return (
    <div
      style={{
        ...nodeStyle,
        borderColor,
        boxShadow: selected
          ? `0 0 0 2px ${borderColor}55, 0 14px 30px rgba(0, 0, 0, 0.28)`
          : nodeStyle.boxShadow,
      }}
    >
      <div style={headerStyle}>
        <span>{typeIcon[type] || "●"}</span>
        <span style={{ color: nodeColor(type) }}>{type.toUpperCase()}</span>
        <span style={{ color: "#888", fontSize: 10, marginLeft: "auto" }}>
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#aaa",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {d.url && `🔗 ${d.url}`}
        {d.module && `📦 ${d.module}`}
        {d.key && `${d.key}=${d.value}`}
        {d.args && `${d.args.filter((a) => a.enabled).length} commands`}
      </div>
      {status && (
        <div
          style={{
            fontSize: 10,
            color: status === "running" ? "#4caf50" : status === "success" ? "#81c784" : "#888",
            marginTop: 4,
          }}
        >
          {status}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 10, height: 10, background: "#fff", border: `2px solid ${borderColor}` }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 10, height: 10, background: "#fff", border: `2px solid ${borderColor}` }}
      />
    </div>
  );
}

export const nodeTypes = {
  custom: CustomNode,
};
