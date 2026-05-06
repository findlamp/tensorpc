import { useState, useEffect } from "react";
import type { FlowNode, AppTemplate } from "../types";

interface NodePropertiesProps {
  node: FlowNode | null;
  allNodes: FlowNode[];
  appTemplates: AppTemplate[];
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
}

const NODE_FIELDS: Record<string, string[]> = {
  directssh: ["url", "username", "password", "enablePortForward", "initCommands"],
  command: ["driver"],
  app: ["driver", "module", "initCode", "initConfig"],
  env: ["key", "value"],
  datastorage: ["inMemoryLimit"],
  group: ["name", "roles", "color"],
  markdown: [],
  input: [],
};

const FIELD_LABELS: Record<string, string> = {
  url: "SSH Host (ip:port)",
  username: "Username",
  password: "Password",
  enablePortForward: "Port Forward",
  initCommands: "Init Commands",
  driver: "SSH Driver",
  module: "Module Name",
  initCode: "Init Code",
  initConfig: "Init Config (JSON)",
  inMemoryLimit: "Memory Limit (MB)",
  key: "Key",
  value: "Value",
  name: "Group Name",
  roles: "Roles (comma)",
  color: "Color",
};

export function NodeProperties({ node, allNodes, appTemplates, onUpdate }: NodePropertiesProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (node) {
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(node.data)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          flat[k] = String(v);
        }
      }
      setFormData(flat);
    } else {
      setFormData({});
    }
  }, [node?.id]);

  if (!node) {
    return (
      <div style={{ padding: 16, color: "#666", fontSize: 13 }}>
        Select a node to edit properties
      </div>
    );
  }

  const commitFormData = (next: Record<string, string>) => {
    setFormData(next);
    onUpdate(node.id, next);
  };

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCommit = (key: string, value: string) => {
    commitFormData({ ...formData, [key]: value });
  };

  const handleSave = () => {
    console.log("🔥 NodeProperties SAVE clicked", { nodeId: node.id, type: node.type, formData });
    onUpdate(node.id, formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSelectTemplate = (templateLabel: string) => {
    const tmpl = appTemplates.find((t) => t.label === templateLabel);
    if (tmpl) {
      commitFormData({
        ...formData,
        module: tmpl.module || formData.module || "",
        initCode: tmpl.initCode || formData.initCode || "",
        initConfig: tmpl.initConfig
          ? JSON.stringify(tmpl.initConfig, null, 2)
          : formData.initConfig || "{}",
      });
    }
  };

  const driverNodes = allNodes.filter((n) => n.type === "directssh");
  const fields = NODE_FIELDS[node.type] || [];
  const typeLabel = node.type.toUpperCase();

  return (
    <div style={{ padding: 12, overflow: "auto", height: "100%" }}>
      <div style={{ color: "#aaa", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {typeLabel} Properties
      </div>
      <div style={{ fontSize: 10, color: "#555", marginBottom: 12 }}>
        id: {node.id}
      </div>

      {/* Template selector for App nodes */}
      {node.type === "app" && appTemplates.length > 0 && (
        <div style={{ marginBottom: 12, padding: 8, backgroundColor: "#252525", borderRadius: 4 }}>
          <label style={{ fontSize: 11, color: "#4fc3f7", display: "block", marginBottom: 4, fontWeight: 600 }}>
            📦 Template
          </label>
          <select
            value=""
            onChange={(e) => handleSelectTemplate(e.target.value)}
            style={{
              width: "100%",
              padding: "5px 8px",
              backgroundColor: "#2a2a2a",
              color: "#ddd",
              border: "1px solid #444",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <option value="">-- Select template --</option>
            {appTemplates.map((t) => (
              <option key={t.label} value={t.label}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {fields.map((key) => {
        if (key === "driver") {
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#aaa", display: "block", marginBottom: 4 }}>
                {FIELD_LABELS[key]}
              </label>
              <select
                value={formData.driver || ""}
                onChange={(e) => handleCommit("driver", e.target.value)}
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  backgroundColor: "#2a2a2a",
                  color: "#ddd",
                  border: "1px solid #444",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                <option value="">-- Not assigned --</option>
                {driverNodes.map((dn) => (
                  <option key={dn.id} value={dn.id}>
                    {dn.data.readableNodeId || dn.id} ({dn.data.url || "no host"})
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (key === "enablePortForward") {
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#aaa", display: "flex", alignItems: "center", gap: 8 }}>
                <input
                type="checkbox"
                checked={formData.enablePortForward === "true"}
                  onChange={(e) => handleCommit("enablePortForward", String(e.target.checked))}
                />
                {FIELD_LABELS[key]}
              </label>
            </div>
          );
        }

        return (
          <div key={key} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "#aaa", display: "block", marginBottom: 3 }}>
              {FIELD_LABELS[key] || key}
            </label>
            {key === "initCode" ? (
              <textarea
                value={formData[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                onBlur={(e) => handleCommit(key, e.target.value)}
                rows={8}
                spellCheck={false}
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  backgroundColor: "#1a1a2e",
                  color: "#cdd6f4",
                  border: "1px solid #444",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  resize: "vertical",
                }}
              />
            ) : key === "initConfig" || key === "initCommands" ? (
              <textarea
                value={formData[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                onBlur={(e) => handleCommit(key, e.target.value)}
                rows={4}
                spellCheck={false}
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  backgroundColor: "#1a1a2e",
                  color: "#cdd6f4",
                  border: "1px solid #444",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  resize: "vertical",
                }}
              />
            ) : key === "password" ? (
              <input
                type="password"
                value={formData[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                onBlur={(e) => handleCommit(key, e.target.value)}
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  backgroundColor: "#2a2a2a",
                  color: "#ddd",
                  border: "1px solid #444",
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              />
            ) : (
              <input
                type="text"
                value={formData[key] || ""}
                onChange={(e) => handleChange(key, e.target.value)}
                onBlur={(e) => handleCommit(key, e.target.value)}
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  backgroundColor: "#2a2a2a",
                  color: "#ddd",
                  border: "1px solid #444",
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              />
            )}
          </div>
        );
      })}

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "#aaa", display: "block", marginBottom: 3 }}>
          Readable ID
        </label>
        <input
          type="text"
          value={formData.readableNodeId || ""}
          onChange={(e) => handleChange("readableNodeId", e.target.value)}
          onBlur={(e) => handleCommit("readableNodeId", e.target.value)}
          style={{
            width: "100%",
            padding: "5px 8px",
            backgroundColor: "#2a2a2a",
            color: "#ddd",
            border: "1px solid #444",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "monospace",
          }}
        />
      </div>

      <button
        onClick={handleSave}
        style={{
          marginTop: 4,
          padding: "6px 20px",
          backgroundColor: saved ? "#4caf50" : "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {saved ? "✓ Saved" : "Save & Sync"}
      </button>
    </div>
  );
}
