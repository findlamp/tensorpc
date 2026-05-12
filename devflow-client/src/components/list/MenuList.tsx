import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Divider from "@mui/material/Divider";
import MuiMenu from "@mui/material/Menu";
import MuiMenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { FrontendEventType } from "../../core/socketTypes";
import { useSendEvent } from "../../hooks/useSendEvent";
import { renderIcon } from "../display/Icon";

type MenuItemShape = {
  id: string;
  label?: string;
  icon?: unknown;
  iconSize?: string;
  iconFontSize?: string | number;
  divider?: boolean;
  disabled?: boolean;
  confirmMessage?: string;
  confirmTitle?: string;
};

type AnchorShape = {
  vertical?: unknown;
  horizontal?: unknown;
};
type AnchorVertical = "top" | "center" | "bottom";
type AnchorHorizontal = "left" | "center" | "right";

function menuItemLabel(item: MenuItemShape): string {
  return typeof item.label === "string" && item.label.length > 0
    ? item.label
    : item.id;
}

function menuIconFontSize(item: MenuItemShape): number | string | undefined {
  if (item.iconFontSize !== undefined) return item.iconFontSize;
  if (item.iconSize === "small") return 18;
  if (item.iconSize === "medium") return 22;
  if (item.iconSize === "large") return 26;
  return undefined;
}

function parseAnchor(value: unknown): { vertical: AnchorVertical; horizontal: AnchorHorizontal } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const anchor = value as AnchorShape;
  const vertical =
    anchor.vertical === "top" || anchor.vertical === "center" || anchor.vertical === "bottom"
      ? (anchor.vertical as AnchorVertical)
      : undefined;
  const horizontal =
    anchor.horizontal === "left" || anchor.horizontal === "center" || anchor.horizontal === "right"
      ? (anchor.horizontal as AnchorHorizontal)
      : undefined;
  if (!vertical || !horizontal) return undefined;
  return { vertical, horizontal };
}

function confirmMenuItem(item: MenuItemShape): boolean {
  if (!item.confirmMessage) return true;
  const title = item.confirmTitle ? `${item.confirmTitle}\n\n` : "";
  return window.confirm(`${title}${item.confirmMessage}`);
}

export function MenuListContent({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const sendEvent = useSendEvent();
  const compUid = props.compUid as string | undefined;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuPaperRef = useRef<HTMLDivElement | null>(null);
  const visibleChildren =
    children.length > 1 && props.renderAllChildren !== true
      ? children.slice(0, 1)
      : children;
  const menuItems = props.menuItems as MenuItemShape[] | undefined;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerMethod = String(props.triggerMethod ?? props.openMethod ?? "click");
  const anchorReference =
    props.anchorReference === "anchorPosition" || props.anchorReference === "none"
      ? props.anchorReference
      : "anchorEl";
  const anchorOrigin = parseAnchor(props.anchorOrigin);
  const transformOrigin = parseAnchor(props.transformOrigin);
  const paperSx = useFlexStyles(
    props.paperProps && typeof props.paperProps === "object"
      ? (props.paperProps as Record<string, unknown>)
      : {},
  );
  const fillsParent =
    props.flex !== undefined ||
    props.flexGrow !== undefined ||
    props.width !== undefined ||
    props.height !== undefined ||
    props.overflow !== undefined ||
    props.display !== undefined;

  const closeMenu = useCallback(() => {
    setAnchorEl(null);
    setAnchorPosition(null);
  }, []);

  const openMenu = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (anchorReference === "anchorPosition") {
      setAnchorPosition({ top: event.clientY, left: event.clientX });
    } else {
      setAnchorPosition(null);
    }
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = (event: MouseEvent<HTMLElement>, item: MenuItemShape) => {
    event.stopPropagation();
    if (item.disabled || item.divider) return;
    if (!confirmMenuItem(item)) return;
    closeMenu();
    if (!compUid) {
      console.warn("tensorpc MenuList item selected without compUid", props);
      return;
    }
    sendEvent(compUid, FrontendEventType.ContextMenuSelect, item.id);
  };

  useEffect(() => {
    if (!anchorEl && !anchorPosition) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        closeMenu();
        return;
      }
      if (rootRef.current?.contains(target) || menuPaperRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [anchorEl, anchorPosition, closeMenu]);

  return (
    <div
      ref={rootRef}
      style={{
        ...sx,
        width: sx.width ?? (fillsParent ? undefined : "auto"),
        height: sx.height ?? (fillsParent ? undefined : "auto"),
        flex: sx.flex,
        minWidth: sx.minWidth ?? (fillsParent ? 0 : undefined),
        minHeight: sx.minHeight ?? (fillsParent ? 0 : undefined),
        display:
          props.display !== undefined || fillsParent ? sx.display : "inline-flex",
        flexDirection: sx.flexDirection ?? "column",
        overflow: sx.overflow ?? "visible",
      }}
      data-tensorpc-comp-uid={compUid}
    >
      <div
        onClickCapture={(event) => {
          if (triggerMethod === "contextmenu") return;
          event.preventDefault();
          openMenu(event);
        }}
        onContextMenuCapture={(event) => {
          if (triggerMethod !== "contextmenu") return;
          event.preventDefault();
          openMenu(event);
        }}
        style={{
          cursor: triggerMethod === "contextmenu" ? "default" : "pointer",
          display: "flex",
          flex: fillsParent ? 1 : undefined,
          width: fillsParent ? "100%" : "auto",
          height: fillsParent ? "100%" : "auto",
          minWidth: 0,
          minHeight: 0,
          flexDirection: "column",
          overflow: sx.overflow ?? (fillsParent ? "hidden" : "visible"),
        }}
      >
        {visibleChildren}
      </div>
      <MuiMenu
        anchorEl={anchorEl}
        anchorReference={anchorReference}
        anchorPosition={anchorReference === "anchorPosition" ? anchorPosition ?? undefined : undefined}
        anchorOrigin={anchorOrigin}
        transformOrigin={transformOrigin}
        open={Boolean(anchorEl || anchorPosition)}
        onClose={closeMenu}
        PaperProps={{
          ref: menuPaperRef,
          sx: paperSx,
          onClick: (event: MouseEvent<HTMLElement>) => event.stopPropagation(),
          onPointerDown: (event: MouseEvent<HTMLElement>) => event.stopPropagation(),
        }}
        MenuListProps={{ dense: props.dense === true }}
      >
        {menuItems?.map((item) =>
          item.divider ? (
            <Divider key={item.id} />
          ) : (
            <MuiMenuItem
              key={item.id}
              disabled={item.disabled === true}
              onClick={(event) => handleMenuItemClick(event, item)}
            >
              {item.icon !== undefined && item.icon !== null ? (
                <ListItemIcon>
                  {renderIcon(item.icon, { fontSize: menuIconFontSize(item) })}
                </ListItemIcon>
              ) : null}
              <ListItemText>{menuItemLabel(item)}</ListItemText>
            </MuiMenuItem>
          ),
        )}
      </MuiMenu>
    </div>
  );
}
