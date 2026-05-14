import type { MouseEvent, ReactNode } from "react";
import MuiTooltip from "@mui/material/Tooltip";
import MuiIconButton from "@mui/material/IconButton";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { renderIcon } from "../display/Icon";
import { useSendEvent } from "../../hooks/useSendEvent";
import { FrontendEventType } from "../../core/socketTypes";
import { getIconName } from "../../render/iconMap";
import { UIType } from "../../render/uiTypes";
import type { ComponentProps } from "../../hooks/useLayoutModel";
import { lookupLayoutNode, normalizeLayoutUid } from "../../utils/layoutRefs";
import { componentChildUids } from "../../utils/dataModelBindings";

function iconFontSize(value: unknown): number | string | undefined {
  if (typeof value === "number" || typeof value === "string") return value;
  return undefined;
}

function iconSizeToFontSize(value: unknown): number | undefined {
  if (value === "small") return 18;
  if (value === "medium") return 22;
  if (value === "large") return 26;
  return undefined;
}

function shouldConfirm(props: Record<string, unknown>): boolean {
  const msg = props.confirmMessage;
  if (typeof msg !== "string" || msg.length === 0) return true;
  const title =
    typeof props.confirmTitle === "string" && props.confirmTitle.length > 0
      ? `${props.confirmTitle}\n\n`
      : "";
  return window.confirm(`${title}${msg}`);
}

function nodeHasPropBinding(node: ComponentProps | undefined, propName: string) {
  if (!node) return false;
  if (
    node.dmProps &&
    typeof node.dmProps === "object" &&
    !Array.isArray(node.dmProps) &&
    propName in node.dmProps
  ) {
    return true;
  }
  if (!Array.isArray(node.dmPropsGrouped)) return false;
  return node.dmPropsGrouped.some((group) => {
    if (!Array.isArray(group) || group.length < 2 || !Array.isArray(group[1])) return false;
    return group[1].some((item) => Array.isArray(item) && item[0] === propName);
  });
}

function buildParentMap(layout: Record<string, ComponentProps>) {
  const parents = new Map<string, string>();
  for (const [uid, node] of Object.entries(layout)) {
    for (const childUid of componentChildUids(node)) {
      parents.set(normalizeLayoutUid(childUid), normalizeLayoutUid(uid));
    }
  }
  return parents;
}

function nearestDataModel(
  uid: string | undefined,
  layout: Record<string, ComponentProps>,
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

function cmdStatusFromNearestDataModel(
  uid: string | undefined,
  layout: Record<string, ComponentProps>,
) {
  const dataObject = nearestDataModel(uid, layout)?.props?.dataObject;
  if (typeof dataObject !== "object" || dataObject === null) return undefined;
  const value = (dataObject as Record<string, unknown>).cmd_status;
  return typeof value === "number" ? value : undefined;
}

function displayIcon(
  props: Record<string, unknown>,
  layout: Record<string, ComponentProps>,
) {
  const iconName = getIconName(props.icon);
  const compUid = props.compUid as string | undefined;
  const node = compUid ? lookupLayoutNode(layout, compUid) : undefined;
  if (
    iconName === "PlayArrow" &&
    nodeHasPropBinding(node, "icon") &&
    (cmdStatusFromNearestDataModel(compUid, layout) ?? 0) > 0
  ) {
    return "Pause";
  }
  const isUncoloredStop =
    iconName === "Stop" &&
    props.muiColor === undefined &&
    props.color === undefined;
  return isUncoloredStop ? "Pause" : props.icon;
}

function isRemoteReconnectButton(props: Record<string, unknown>) {
  return props.tooltip === "Reconnect to remote component";
}

export function IconButton({
  props,
  layout,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (props.disabled === true) return;
    if (!shouldConfirm(props)) return;
    if (!compUid) {
      console.warn("tensorpc IconButton clicked without compUid", props);
      return;
    }
    const sent = sendEvent(compUid, FrontendEventType.Click, null);
    if (isRemoteReconnectButton(props)) {
      window.dispatchEvent(
        new CustomEvent("tensorpc-remote-component-reconnect", {
          detail: { compUid, sent },
        }),
      );
    }
  };

  const fontSize =
    iconFontSize(props.iconFontSize) ??
    iconSizeToFontSize(props.iconSize) ??
    iconSizeToFontSize(props.size);
  const label =
    typeof props.tooltip === "string" && props.tooltip.length > 0
      ? props.tooltip
      : typeof props.name === "string" && props.name.length > 0
        ? props.name
        : getIconName(displayIcon(props, layout)) ?? "button";

  return (
    <MuiTooltip title={props.tooltip ? String(props.tooltip) : ""}>
      <MuiIconButton
        size={props.size as "small" | "medium" | "large" | undefined}
        color={props.muiColor as "primary" | "secondary" | "error" | "info" | "success" | "warning" | undefined}
        disabled={props.disabled === true}
        sx={sx}
        onClick={handleClick}
        aria-label={label}
        data-tensorpc-comp-uid={compUid}
      >
        {renderIcon(displayIcon(props, layout), { fontSize })}
      </MuiIconButton>
    </MuiTooltip>
  );
}
