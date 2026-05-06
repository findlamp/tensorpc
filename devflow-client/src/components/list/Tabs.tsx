import type { ReactNode } from "react";
import MuiTab from "@mui/material/Tab";
import MuiTabs from "@mui/material/Tabs";
import { useFlexStyles } from "../../hooks/useFlexStyles";

function compactTabLabel(label: unknown) {
  if (typeof label !== "string") return label as ReactNode;
  return label
    .replace(/^<|>$/g, "")
    .replace(/^tensorpc-flow-cflow-/, "")
    .replace(/^tensorpc-flow-/, "");
}

export function Tabs({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const childsComplex = props.childsComplex as Record<string, unknown> | undefined;
  const tabDefs = childsComplex?.tabDefs as Array<{ label: string; value: string; component: unknown }> | undefined;
  const activeValue = String(props.value ?? "");
  const vertical = props.orientation === "vertical";

  // Children are the tab panels, rendered in the same order as tabDefs
  return (
    <div
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height: sx.height ?? "100%",
        minWidth: sx.minWidth ?? 0,
        minHeight: sx.minHeight ?? 0,
        display: "flex",
        flexDirection: vertical ? "row" : "column",
        overflow: "hidden",
      }}
    >
      <MuiTabs
        value={activeValue}
        orientation={vertical ? "vertical" : "horizontal"}
        variant={props.variant as "scrollable" | "fullWidth" | "standard" | undefined}
        textColor={props.textColor as "inherit" | "primary" | "secondary" | undefined}
        indicatorColor={props.indicatorColor as "primary" | "secondary" | undefined}
        centered={props.centered === true}
        sx={{
          flexShrink: 0,
          minWidth: vertical ? 40 : undefined,
          maxWidth: vertical ? 56 : undefined,
          borderRight: vertical ? "1px solid #e0e0e0" : undefined,
          borderBottom: vertical ? undefined : "1px solid #e0e0e0",
          "& .MuiTab-root": {
            minWidth: vertical ? 40 : undefined,
            maxWidth: vertical ? 56 : 220,
            minHeight: 38,
            padding: vertical ? "6px 4px" : "6px 12px",
            fontSize: 12,
            textTransform: "none",
            whiteSpace: "nowrap",
          },
          "& .MuiTab-root .MuiTab-wrapper, & .MuiTab-root": {
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        }}
      >
        {tabDefs?.map((td) => (
          <MuiTab
            key={td.value}
            label={compactTabLabel(td.label)}
            value={td.value}
            title={typeof td.label === "string" ? td.label : undefined}
          />
        ))}
      </MuiTabs>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        {children.map((child, i) => {
          const tabUid = tabDefs?.[i]?.value ?? "";
          return (
            <div
              key={tabUid || i}
              style={{
                display: tabUid === activeValue ? "flex" : "none",
                width: "100%",
                height: "100%",
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
