import type { CSSProperties } from "react";
import type { FlexComponentBaseProps } from "../components/types";
import { normalizeLayoutUid } from "./layoutRefs";

export function numOrStr(v: unknown): string | number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" || typeof v === "string") return v;
  return String(v);
}

function borderValue(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return `${v}px solid`;
  if (typeof v === "string") return v;
  return String(v);
}

/** Build CSS styles from FlexComponentBaseProps fields */
export function flexStyles(
  p: Partial<FlexComponentBaseProps>,
): CSSProperties {
  return {
    width: numOrStr(p.width),
    height: numOrStr(p.height),
    minWidth: numOrStr(p.minWidth),
    minHeight: numOrStr(p.minHeight),
    maxWidth: numOrStr(p.maxWidth),
    maxHeight: numOrStr(p.maxHeight),
    margin: numOrStr(p.margin),
    marginTop: numOrStr(p.marginTop),
    marginBottom: numOrStr(p.marginBottom),
    marginLeft: numOrStr(p.marginLeft),
    marginRight: numOrStr(p.marginRight),
    padding: numOrStr(p.padding),
    paddingTop: numOrStr(p.paddingTop),
    paddingBottom: numOrStr(p.paddingBottom),
    paddingLeft: numOrStr(p.paddingLeft),
    paddingRight: numOrStr(p.paddingRight),
    flexGrow: typeof p.flexGrow === "number" ? p.flexGrow : undefined,
    flexShrink: typeof p.flexShrink === "number" ? p.flexShrink : undefined,
    flexBasis: numOrStr(p.flexBasis),
    flex: numOrStr(p.flex),
    alignSelf: p.alignSelf as CSSProperties["alignSelf"],
    alignItems: p.alignItems as CSSProperties["alignItems"],
    justifyContent: p.justifyContent as CSSProperties["justifyContent"],
    flexDirection: p.flexDirection as CSSProperties["flexDirection"],
    flexWrap: p.flexWrap as CSSProperties["flexWrap"],
    flexFlow: p.flexFlow as CSSProperties["flexFlow"],
    gap: numOrStr(p.gap),
    overflow: p.overflow as CSSProperties["overflow"],
    overflowX: p.overflowX as CSSProperties["overflowX"],
    overflowY: p.overflowY as CSSProperties["overflowY"],
    position: p.position as CSSProperties["position"],
    left: numOrStr(p.left),
    top: numOrStr(p.top),
    right: numOrStr(p.right),
    bottom: numOrStr(p.bottom),
    zIndex: typeof p.zIndex === "number" ? p.zIndex : undefined,
    backgroundColor: p.backgroundColor as string | undefined,
    background: p.background as string | undefined,
    color: p.color as string | undefined,
    border: p.border as string | undefined,
    borderTop: borderValue(p.borderTop),
    borderRight: borderValue(p.borderRight),
    borderBottom: borderValue(p.borderBottom),
    borderLeft: borderValue(p.borderLeft),
    borderColor: p.borderColor === "divider" ? "#e0e0e0" : p.borderColor as string | undefined,
    borderRadius: numOrStr(p.borderRadius),
    fontSize: numOrStr(p.fontSize),
    fontFamily: p.fontFamily as string | undefined,
    textAlign: p.textAlign as CSSProperties["textAlign"],
    cursor: p.cursor as CSSProperties["cursor"],
    display: (p.display as CSSProperties["display"]) ?? "flex",
    boxSizing: "border-box",
    whiteSpace: p.whiteSpace as CSSProperties["whiteSpace"],
    wordBreak: p.wordBreak as CSSProperties["wordBreak"],
    textOverflow: p.textOverflow as CSSProperties["textOverflow"],
    pointerEvents: p.pointerEvents as CSSProperties["pointerEvents"],
    transform: p.transform as CSSProperties["transform"],
    boxShadow: p.boxShadow as string | undefined,
    outline: p.outline as string | undefined,
  };
}

export function childUids(props: Record<string, unknown>): string[] {
  const c = props.childs;
  if (!Array.isArray(c)) return [];
  return c.map((x) => normalizeLayoutUid(x));
}
