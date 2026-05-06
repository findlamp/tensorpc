export function NodePalette({ onAddNode }: { onAddNode: (type: string) => void }) {
  const NODE_TYPES = [
    { type: "directssh", label: "SSH Driver", icon: "🖥️", desc: "Remote SSH connection" },
    { type: "command", label: "Command", icon: "⚡", desc: "Run shell commands" },
    { type: "app", label: "App", icon: "📦", desc: "Python app node" },
    { type: "env", label: "Env Var", icon: "🔧", desc: "Environment variable" },
    { type: "datastorage", label: "Data Storage", icon: "💾", desc: "Persistent storage" },
    { type: "group", label: "Group", icon: "📁", desc: "Group nodes" },
    { type: "markdown", label: "Markdown", icon: "📝", desc: "Documentation" },
  ];

  return (
    <div
      style={{
        padding: 12,
        borderRight: "1px solid #333",
        backgroundColor: "#1a1a1a",
        height: "100%",
        overflow: "auto",
      }}
    >
      <div style={{ color: "#aaa", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        Node Types
      </div>
      {NODE_TYPES.map((nt) => (
        <div
          key={nt.type}
          onClick={() => onAddNode(nt.type)}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("nodeType", nt.type)}
          style={{
            padding: "8px 10px",
            marginBottom: 6,
            borderRadius: 6,
            border: "1px solid #444",
            backgroundColor: "#252525",
            cursor: "grab",
            fontSize: 12,
            color: "#ccc",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>{nt.icon}</span>
          <div>
            <div style={{ fontWeight: 600 }}>{nt.label}</div>
            <div style={{ fontSize: 10, color: "#888" }}>{nt.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
