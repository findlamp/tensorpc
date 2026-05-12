import { useEffect, useState, type ReactNode } from "react";
import MuiTab from "@mui/material/Tab";
import MuiTabs from "@mui/material/Tabs";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { renderIcon } from "../display/Icon";
import { useSendEvent } from "../../hooks/useSendEvent";
import { FrontendEventType } from "../../core/socketTypes";

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
  const sendEvent = useSendEvent();
  const compUid = typeof props.compUid === "string" ? props.compUid : "";
  const childsComplex = props.childsComplex as Record<string, unknown> | undefined;
  const tabDefs = childsComplex?.tabDefs as
    | Array<{
        label: string;
        value: string;
        component: unknown;
        icon?: unknown;
        iconPosition?: "start" | "end" | "bottom" | "top";
        iconFontSize?: unknown;
        tooltip?: string;
      }>
    | undefined;
  const requestedValue = String(props.value ?? "");
  const resolvedValue =
    tabDefs?.some((td) => td.value === requestedValue) === true
      ? requestedValue
      : tabDefs?.[0]?.value ?? requestedValue;
  const [localValue, setLocalValue] = useState(resolvedValue);
  const activeValue =
    tabDefs?.some((td) => td.value === localValue) === true
      ? localValue
      : resolvedValue;

  useEffect(() => {
    setLocalValue(resolvedValue);
  }, [resolvedValue]);

  const vertical = props.orientation === "vertical";
  const checkpointTabs =
    tabDefs?.length === 1 &&
    (tabDefs[0]?.value === "Checkpoint" || tabDefs[0]?.label === "Checkpoint");
  const shouldFill =
    vertical ||
    checkpointTabs ||
    sx.height !== undefined ||
    sx.flex !== undefined ||
    sx.flexGrow !== undefined;
  const height = sx.height ?? (shouldFill ? "100%" : undefined);
  // Children are the tab panels, rendered in the same order as tabDefs
  return (
    <div
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height,
        flex: sx.flex ?? (checkpointTabs ? "1 1 0%" : undefined),
        minWidth: sx.minWidth ?? 0,
        minHeight: sx.minHeight ?? 0,
        display: "flex",
        flexDirection: vertical ? "row" : "column",
        flexFlow: vertical ? "row nowrap" : "column nowrap",
        overflow: "hidden",
      }}
    >
      <MuiTabs
        value={activeValue}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event, nextValue) => {
          event.stopPropagation();
          const value = String(nextValue);
          setLocalValue(value);
          if (compUid && !vertical) {
            sendEvent(compUid, FrontendEventType.Change, value);
          }
        }}
        orientation={vertical ? "vertical" : "horizontal"}
        variant={props.variant as "scrollable" | "fullWidth" | "standard" | undefined}
        textColor={props.textColor as "inherit" | "primary" | "secondary" | undefined}
        indicatorColor={props.indicatorColor as "primary" | "secondary" | undefined}
        centered={props.centered === true}
        sx={{
          flexShrink: 0,
          minWidth: vertical ? 40 : undefined,
          maxWidth: vertical ? 56 : undefined,
          borderRight: vertical ? "1px solid var(--td-border)" : undefined,
          borderBottom: vertical ? undefined : "1px solid var(--td-border)",
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
        {tabDefs?.map((td) => {
          const iconNode = renderIcon(td.icon, {
            fontSize: td.iconFontSize as string | number | undefined,
          });
          const icon = iconNode ? (
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              {iconNode}
            </span>
          ) : undefined;
          const label = vertical && icon ? undefined : compactTabLabel(td.label);
          const title = td.tooltip || (typeof td.label === "string" ? td.label : undefined);
          return (
            <MuiTab
              key={td.value}
              icon={icon}
              iconPosition={td.iconPosition ?? (vertical ? "top" : "start")}
              label={label || (icon ? undefined : " ")}
              value={td.value}
              title={title}
            />
          );
        })}
      </MuiTabs>
      <div
        style={{
          flex: shouldFill ? 1 : undefined,
          minWidth: 0,
          minHeight: 0,
          position: shouldFill ? "relative" : undefined,
          contain: vertical ? "layout paint" : undefined,
          isolation: vertical ? "isolate" : undefined,
          overflow: "hidden",
        }}
      >
        {children.map((child, i) => {
          const tabUid = tabDefs?.[i]?.value ?? "";
          return (
            <div
              key={tabUid || i}
              style={{
                display: tabUid === activeValue ? "flex" : "none",
                position: shouldFill ? "absolute" : checkpointTabs ? "relative" : undefined,
                inset: shouldFill ? 0 : undefined,
                width: "100%",
                height: shouldFill ? "100%" : undefined,
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
