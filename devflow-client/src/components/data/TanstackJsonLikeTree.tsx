import { useState, type ReactNode } from "react";

interface TreeNode {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  typeStr?: unknown;
  value?: unknown;
  cnt?: unknown;
  children?: TreeNode[];
  color?: unknown;
  drag?: unknown;
  edit?: unknown;
  iconBtns?: unknown[];
  fixedIconBtns?: unknown[];
  menus?: unknown[];
  userdata?: unknown;
  alias?: unknown;
}

function toStr(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function typeName(t: unknown): string {
  const map: Record<number, string> = {
    0: "int", 1: "float", 2: "bool", 3: "const", 4: "str",
    5: "list", 6: "dict", 7: "tuple", 8: "set", 9: "tensor",
    10: "obj", 11: "complex", 12: "enum", 13: "layout",
    14: "list+", 15: "dict+", 16: "func",
  };
  if (typeof t === "number") return map[t] ?? `type(${t})`;
  return "";
}

function safeJsonParse(v: unknown): string {
  if (typeof v !== "string") return String(v ?? "");
  try {
    const parsed = JSON.parse(v);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return v;
  }
}

function extractTree(props: Record<string, unknown>) {
  if (props.tree && typeof props.tree === "object") return props.tree as TreeNode;
  if (typeof props.tree === "string") {
    try {
      return JSON.parse(props.tree) as TreeNode;
    } catch {
      return null;
    }
  }
  const indexed = props.__jsonarray_index;
  if (Array.isArray(indexed) && indexed.length > 0) {
    const first = indexed[0];
    if (first && typeof first === "object" && "tree" in first) {
      return (first as { tree?: TreeNode }).tree ?? null;
    }
  }
  return null;
}

function TreeNodeRow({
  node,
  depth,
  ignoreRoot,
}: {
  node: TreeNode;
  depth: number;
  ignoreRoot: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isFolder = node.type === 14 || node.type === 15;
  const showExpand = hasChildren || isFolder;

  const name = toStr(node.name);
  const typeStr = toStr(node.typeStr) || typeName(node.type);
  const value = node.value !== undefined ? safeJsonParse(node.value) : "";
  const color = toStr(node.color);
  const cnt = node.cnt ? Number(node.cnt) : 0;
  const children = node.children ?? [];

  if (ignoreRoot && depth === 0) {
    return (
      <>
        {children.map((child, i) => (
          <TreeNodeRow key={i} node={child} depth={depth} ignoreRoot={false} />
        ))}
      </>
    );
  }

  const indent = depth * 16;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "2px 4px",
          paddingLeft: 4 + indent,
          cursor: showExpand ? "pointer" : "default",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
          fontSize: 12,
          lineHeight: "20px",
          borderBottom: "1px solid transparent",
          userSelect: "none",
        }}
        onClick={() => showExpand && setExpanded(!expanded)}
      >
        {/* Expand arrow */}
        <span
          style={{
            width: 14,
            color: showExpand ? "var(--td-text)" : "var(--td-text-muted)",
            flexShrink: 0,
          }}
        >
          {showExpand ? (expanded ? "▼" : "▶") : " "}
        </span>

        {/* Name */}
        <span style={{ color: color || "var(--td-text)", fontWeight: 500 }}>
          {name || "(root)"}
        </span>

        {/* Type badge */}
        {typeStr && (
          <span
            style={{
              marginLeft: 6,
              padding: "0 4px",
              borderRadius: 3,
              background: "transparent",
              color: "var(--td-green)",
              fontSize: 10,
            }}
          >
            {typeStr}
          </span>
        )}

        {/* Count for lazy folders */}
        {cnt > 0 && !hasChildren && (
          <span style={{ marginLeft: 4, color: "var(--td-text-muted)", fontSize: 10 }}>
            ({cnt})
          </span>
        )}

        {/* Inline value for simple types */}
        {!showExpand && value && (
          <span style={{ marginLeft: 8, color: "var(--td-blue)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {value.length > 80 ? value.slice(0, 80) + "..." : value}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && showExpand && (
        <div>
          {children.map((child, i) => (
            <TreeNodeRow key={i} node={child} depth={depth + 1} ignoreRoot={false} />
          ))}
          {/* Lazy load hint */}
          {cnt > 0 && children.length === 0 && (
            <div
              style={{
                paddingLeft: 4 + indent + 14,
                color: "var(--td-text-muted)",
                fontSize: 11,
                fontStyle: "italic",
              }}
            >
              {cnt} items (expand to load)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TanstackJsonLikeTree({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const ignoreRoot = Boolean(props.ignoreRoot);

  const treeData = extractTree(props);

  if (!treeData) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          padding: 8,
          color: "var(--td-text-muted)",
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
        }}
      >
        (empty tree)
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        background: "var(--td-surface)",
        color: "var(--td-text)",
      }}
    >
      <TreeNodeRow node={treeData} depth={0} ignoreRoot={ignoreRoot} />
    </div>
  );
}
