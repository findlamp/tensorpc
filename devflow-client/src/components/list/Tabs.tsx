import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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
  const panelProps = pickObject(props.panelProps, childsComplex?.panelProps);
  const beforeProps = pickObject(props.beforeProps, childsComplex?.beforeProps);
  const afterProps = pickObject(props.afterProps, childsComplex?.afterProps);
  const panelSx = useFlexStyles(panelProps);
  const beforeSx = useFlexStyles(beforeProps);
  const afterSx = useFlexStyles(afterProps);
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
  const iconOnlyTabs =
    tabDefs?.some((td) => td.icon !== undefined && td.icon !== null) === true &&
    tabDefs.every((td) => typeof td.label !== "string" || td.label.length === 0);
  const beforeNodes = Array.isArray(props.__beforeNodes)
    ? (props.__beforeNodes as ReactNode[])
    : [];
  const afterNodes = Array.isArray(props.__afterNodes)
    ? (props.__afterNodes as ReactNode[])
    : [];
  const hasHeaderExtras = !vertical && (beforeNodes.length > 0 || afterNodes.length > 0);
  const shouldFill =
    vertical ||
    checkpointTabs ||
    hasHeaderExtras ||
    sx.height !== undefined ||
    sx.flex !== undefined ||
    sx.flexGrow !== undefined ||
    sx.display === "flex" ||
    sx.flexFlow !== undefined;
  const height = sx.height ?? (shouldFill ? "100%" : undefined);
  const tabBar = (
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
        alignSelf: hasHeaderExtras ? "stretch" : undefined,
        minHeight: iconOnlyTabs ? 28 : undefined,
        minWidth: vertical ? 40 : undefined,
        maxWidth: vertical ? 56 : undefined,
        borderRight: vertical ? "1px solid var(--td-border)" : undefined,
        borderBottom: vertical || hasHeaderExtras ? undefined : "1px solid var(--td-border)",
        "& .MuiTabs-flexContainer": {
          height: hasHeaderExtras ? "100%" : undefined,
          alignItems: hasHeaderExtras ? "center" : undefined,
        },
        "& .MuiTab-root": {
          minWidth: vertical ? 40 : iconOnlyTabs ? 28 : undefined,
          maxWidth: vertical ? 56 : iconOnlyTabs ? 28 : 220,
          minHeight: iconOnlyTabs ? 28 : 38,
          padding: iconOnlyTabs ? 0 : vertical ? "6px 4px" : "6px 12px",
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
  );

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
        alignItems: vertical ? sx.alignItems : "stretch",
        overflow: "hidden",
      }}
    >
      {hasHeaderExtras ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            width: "100%",
            minWidth: 0,
            height: 32,
            borderBottom: "1px solid var(--td-border)",
            background: "var(--td-panel-header-bg, var(--td-bg))",
            overflow: "hidden",
          }}
        >
          {beforeNodes.length > 0 ? (
            <div style={headerSlotStyle(beforeSx, true)}>{beforeNodes}</div>
          ) : null}
          {tabBar}
          {afterNodes.length > 0 ? (
            <div style={headerSlotStyle(afterSx, false)}>{afterNodes}</div>
          ) : null}
        </div>
      ) : (
        tabBar
      )}
      <div
        style={{
          flex: shouldFill ? 1 : undefined,
          width: "100%",
          alignSelf: "stretch",
          minWidth: 0,
          minHeight: 0,
          display: shouldFill ? "flex" : undefined,
          flexDirection: "column",
          contain: vertical ? "layout paint" : undefined,
          isolation: vertical ? "isolate" : undefined,
          overflow: "hidden",
        }}
      >
        {children.map((child, i) => {
          const tabUid = tabDefs?.[i]?.value ?? "";
          const isActive = tabUid === activeValue;
          if (!shouldFill && !isActive) return null;
          return (
            <div
              key={tabUid || i}
              aria-hidden={!isActive}
              style={{
                ...panelSx,
                display: shouldFill && !isActive ? "none" : "flex",
                position: checkpointTabs ? "relative" : undefined,
                flexDirection: "column",
                alignItems: "stretch",
                flex: panelSx.flex ?? (shouldFill ? "1 1 0%" : undefined),
                width: panelSx.width ?? "100%",
                height: panelSx.height ?? (shouldFill ? "100%" : undefined),
                minWidth: panelSx.minWidth ?? 0,
                minHeight: panelSx.minHeight ?? 0,
                overflow: panelSx.overflow ?? "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: shouldFill ? "1 1 0%" : undefined,
                  width: "100%",
                  height: shouldFill ? "100%" : undefined,
                  minWidth: 0,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                {child}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pickObject(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return {};
}

function headerSlotStyle(base: CSSProperties, primary: boolean): CSSProperties {
  return {
    ...base,
    display: "flex",
    alignItems: base.alignItems ?? "center",
    flex: base.flex ?? (primary ? "1 1 auto" : "0 0 auto"),
    flexShrink: base.flexShrink ?? (primary ? 1 : 0),
    minWidth: base.minWidth ?? 0,
    height: base.height ?? "100%",
    overflow: base.overflow ?? "hidden",
  };
}
