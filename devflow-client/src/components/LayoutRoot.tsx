import type { AppEventMessage } from "../core/tensorPcWs";
import { AppEventType } from "../core/socketTypes";
import { ComponentNode } from "../components/ComponentNode";
import type { ComponentProps, LayoutModel } from "../hooks/useLayoutModel";
import { normalizeLayoutUid, patchLayoutUidWithPrefixes } from "../utils/layoutRefs";

function childUids(props: Record<string, unknown>): string[] {
  const c = props.childs;
  if (!Array.isArray(c)) return [];
  return c.map((x) => normalizeLayoutUid(x));
}

function findRootUid(layout: Record<string, ComponentProps>): string | null {
  if (layout["1|R"]) return "1|R";
  for (const [uid, c] of Object.entries(layout)) {
    if (String(c.uid ?? "") === "1|R") return uid;
  }
  const referenced = new Set<string>();
  for (const c of Object.values(layout)) {
    for (const uid of childUids(c.props ?? {})) {
      referenced.add(uid);
    }
  }
  for (const uid of Object.keys(layout)) {
    if (!referenced.has(uid) && uid.endsWith("|R")) {
      return uid;
    }
  }
  for (const uid of Object.keys(layout)) {
    if (!referenced.has(uid)) {
      return uid;
    }
  }
  return Object.keys(layout)[0] ?? null;
}

export function extractUpdateLayout(ev: AppEventMessage): LayoutModel | null {
  for (const [t, payload] of ev.typeToEvents) {
    if (t === AppEventType.UpdateLayout) {
      const layout = normalizeLayoutPayload(payload);
      if (layout) {
        return layout;
      }
    }
  }
  return null;
}

export function applyUpdateComponents(
  layout: LayoutModel | null,
  payload: unknown,
  remotePrefixes?: unknown,
): LayoutModel | null {
  if (!layout || !payload || typeof payload !== "object") return layout;
  const event = payload as { new?: unknown; del?: unknown };
  const nextEntries = { ...layout.layout };
  if (Array.isArray(event.del)) {
    for (const uid of event.del) {
      delete nextEntries[patchLayoutUidWithPrefixes(uid, remotePrefixes)];
    }
  }
  if (event.new && typeof event.new === "object") {
    for (const [uid, update] of Object.entries(event.new as Record<string, unknown>)) {
      if (!update || typeof update !== "object") continue;
      const normalizedUid = patchLayoutUidWithPrefixes(uid, remotePrefixes);
      const current = nextEntries[normalizedUid];
      const patch = normalizeComponentPatch(
        update as Partial<ComponentProps> & Record<string, unknown>,
        normalizedUid,
      );
      if (typeof patch.type === "number" && patch.props && typeof patch.props === "object") {
        nextEntries[normalizedUid] = patch as ComponentProps;
      } else if (current) {
        const propPatch =
          patch.props && typeof patch.props === "object"
            ? (normalizeUidRefs(patch.props) as Record<string, unknown>)
            : (normalizeUidRefs(patch) as Record<string, unknown>);
        nextEntries[normalizedUid] = {
          ...current,
          props: {
            ...current.props,
            ...propPatch,
          },
        };
      }
    }
  }
  return { ...layout, layout: nextEntries };
}

export function applyUiUpdateEvent(
  layout: LayoutModel | null,
  payload: unknown,
  remotePrefixes?: unknown,
  target: "props" | "base" = "props",
): LayoutModel | null {
  if (!layout || !payload || typeof payload !== "object") return layout;
  const nextEntries = { ...layout.layout };
  let changed = false;

  for (const [uid, update] of Object.entries(payload as Record<string, unknown>)) {
    const normalizedUid = patchLayoutUidWithPrefixes(uid, remotePrefixes);
    const current = nextEntries[normalizedUid];
    if (!current) continue;

    const tuple = normalizeUiUpdateTuple(update);
    if (!tuple) continue;
    const [data, undefinedKeys] = tuple;
    if (target === "base") {
      const nextNode = {
        ...current,
        ...(normalizeUidRefs(data) as Record<string, unknown>),
      } as ComponentProps;
      for (const key of undefinedKeys) {
        delete (nextNode as Record<string, unknown>)[key];
      }
      nextEntries[normalizedUid] = nextNode;
    } else {
      const nextProps = {
        ...current.props,
        ...(normalizeUidRefs(data) as Record<string, unknown>),
      };
      for (const key of undefinedKeys) {
        delete nextProps[key];
      }
      nextEntries[normalizedUid] = {
        ...current,
        props: nextProps,
      };
    }
    changed = true;
  }

  return changed ? { ...layout, layout: nextEntries } : layout;
}

export function applyUpdateUsedEvents(
  layout: LayoutModel | null,
  payload: unknown,
  remotePrefixes?: unknown,
): LayoutModel | null {
  if (!layout || !payload || typeof payload !== "object") return layout;
  const nextEntries = { ...layout.layout };
  let changed = false;
  for (const [uid, usedEvents] of Object.entries(payload as Record<string, unknown>)) {
    const normalizedUid = patchLayoutUidWithPrefixes(uid, remotePrefixes);
    const current = nextEntries[normalizedUid];
    if (!current) continue;
    nextEntries[normalizedUid] = {
      ...current,
      usedEvents: Array.isArray(usedEvents) ? usedEvents : current.usedEvents,
    };
    changed = true;
  }
  return changed ? { ...layout, layout: nextEntries } : layout;
}

const DRAFT_OP = {
  SetAttr: 0,
  Delete: 1,
  Extend: 2,
  ArraySet: 4,
  ArrayPop: 5,
  ArrayInsert: 6,
  ArrayRemove: 7,
  ContainerClear: 8,
  DictUpdate: 10,
  Assign: 11,
  ScalarInplaceOp: 20,
} as const;

function decodeUniqueTreeIdParts(value: string): string[] | null {
  const splitIndex = value.indexOf("|");
  if (splitIndex < 0) return null;
  const lengths = value
    .slice(0, splitIndex)
    .split(".")
    .map((part) => Number(part));
  if (lengths.some((part) => !Number.isFinite(part) || part < 0)) return null;
  const payload = value.slice(splitIndex + 1);
  const splitterLength =
    payload.length - lengths.reduce((sum, length) => sum + length, 0);
  const gap = lengths.length > 1 ? splitterLength / (lengths.length - 1) : 0;
  if (!Number.isInteger(gap) || gap < 0) return null;
  const parts: string[] = [];
  let cursor = 0;
  for (const length of lengths) {
    parts.push(payload.slice(cursor, cursor + length));
    cursor += length + gap;
  }
  return parts;
}

function draftPathExpression(value: unknown): string {
  if (typeof value !== "string") return "";
  return decodeUniqueTreeIdParts(value)?.[0] ?? value;
}

function parseDraftPath(value: unknown): Array<string | number> | null {
  const expr = draftPathExpression(value).trim();
  if (!expr || expr === "getRoot()" || expr === "$") return [];
  const parts: Array<string | number> = [];
  const re = /(?:^|\.)([A-Za-z_$][\w$]*)|\[(\d+)\]|\[['"]([^'"]+)['"]\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(expr))) {
    if (match.index !== cursor) return null;
    if (match[1]) parts.push(match[1]);
    else if (match[2]) parts.push(Number(match[2]));
    else if (match[3]) parts.push(match[3]);
    cursor = re.lastIndex;
  }
  return cursor === expr.length ? parts : null;
}

function cloneContainer(value: unknown): unknown {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function draftPathTarget(root: unknown, path: Array<string | number>) {
  let nextRoot = cloneContainer(root);
  let cursor = nextRoot as Record<string, unknown> | unknown[];
  for (let i = 0; i < path.length; i++) {
    const key = path[i]!;
    const current =
      Array.isArray(cursor) && typeof key === "number"
        ? cursor[key]
        : !Array.isArray(cursor) && typeof key === "string"
          ? (cursor as Record<string, unknown>)[key]
          : undefined;
    const cloned = cloneContainer(current);
    if (Array.isArray(cursor) && typeof key === "number") {
      cursor[key] = cloned;
    } else if (!Array.isArray(cursor) && typeof key === "string") {
      (cursor as Record<string, unknown>)[key] = cloned;
    }
    cursor = cloned as Record<string, unknown> | unknown[];
  }
  return { root: nextRoot, target: cursor };
}

function applyScalarOp(current: unknown, op: unknown, value: unknown) {
  if (typeof current !== "number" || typeof value !== "number") return current;
  if (op === 0) return current + value;
  if (op === 1) return current - value;
  if (op === 2) return current * value;
  if (op === 3) return current / value;
  return current;
}

function applyDraftOpsToModel(model: unknown, ops: unknown[]): unknown {
  let root = model;
  for (const rawOp of ops) {
    if (!rawOp || typeof rawOp !== "object") continue;
    const op = rawOp as { path?: unknown; op?: unknown; opData?: unknown };
    const path = parseDraftPath(op.path);
    if (!path) continue;
    const { root: nextRoot, target } = draftPathTarget(root, path);
    const data = op.opData as Record<string, unknown>;

    if (op.op === DRAFT_OP.SetAttr && data && Array.isArray(data.items)) {
      if (target && typeof target === "object") {
        for (const item of data.items) {
          if (!Array.isArray(item) || item.length < 2) continue;
          (target as Record<string, unknown>)[String(item[0])] = item[1];
        }
      }
    } else if (op.op === DRAFT_OP.DictUpdate && data && data.items && typeof data.items === "object") {
      if (target && typeof target === "object" && !Array.isArray(target)) {
        Object.assign(target as Record<string, unknown>, data.items);
      }
    } else if (op.op === DRAFT_OP.ArraySet && data && Array.isArray(data.items)) {
      if (Array.isArray(target)) {
        for (const item of data.items) {
          if (!Array.isArray(item) || item.length < 2) continue;
          const index = Number(item[0]);
          if (Number.isInteger(index)) target[index] = item[1];
        }
      }
    } else if (op.op === DRAFT_OP.Extend && data && Array.isArray(data.items)) {
      if (Array.isArray(target)) target.push(...data.items);
    } else if (op.op === DRAFT_OP.ArrayInsert && data) {
      if (Array.isArray(target)) target.splice(Number(data.index ?? 0), 0, data.item);
    } else if (op.op === DRAFT_OP.ArrayPop) {
      if (Array.isArray(target)) {
        const index = typeof data?.index === "number" ? data.index : target.length - 1;
        target.splice(index, 1);
      }
    } else if (op.op === DRAFT_OP.ArrayRemove && data) {
      if (Array.isArray(target)) {
        const index = target.indexOf(data.item);
        if (index >= 0) target.splice(index, 1);
      }
    } else if (op.op === DRAFT_OP.Delete && data && Array.isArray(data.keys)) {
      if (target && typeof target === "object") {
        for (const key of data.keys) {
          delete (target as Record<string, unknown>)[String(key)];
        }
      }
    } else if (op.op === DRAFT_OP.ContainerClear) {
      if (Array.isArray(target)) target.length = 0;
      else if (target && typeof target === "object") {
        for (const key of Object.keys(target as Record<string, unknown>)) {
          delete (target as Record<string, unknown>)[key];
        }
      }
    } else if (op.op === DRAFT_OP.ScalarInplaceOp && data) {
      const key = data.key;
      if (target && typeof target === "object" && typeof key === "string") {
        const obj = target as Record<string, unknown>;
        obj[key] = applyScalarOp(obj[key], data.op, data.value);
      }
    }
    root = nextRoot;
  }
  return root;
}

export function applyDataModelComponentEvents(
  layout: LayoutModel | null,
  payload: unknown,
  remotePrefixes?: unknown,
): LayoutModel | null {
  if (!layout || !payload || typeof payload !== "object") return layout;
  const nextEntries = { ...layout.layout };
  let changed = false;

  for (const [uid, event] of Object.entries(payload as Record<string, unknown>)) {
    const normalizedUid = patchLayoutUidWithPrefixes(uid, remotePrefixes);
    const current = nextEntries[normalizedUid];
    if (!current || current.type !== 0x10000 || !event || typeof event !== "object") {
      continue;
    }
    const data = event as { type?: unknown; ops?: unknown };
    if (data.type !== 0 || !Array.isArray(data.ops)) continue;
    const nextDataObject = applyDraftOpsToModel(current.props.dataObject, data.ops);
    if (nextDataObject === current.props.dataObject) continue;
    nextEntries[normalizedUid] = {
      ...current,
      props: {
        ...current.props,
        dataObject: nextDataObject,
      },
    };
    changed = true;
  }

  return changed ? { ...layout, layout: nextEntries } : layout;
}

function normalizeUiUpdateTuple(update: unknown): [Record<string, unknown>, string[]] | null {
  if (!Array.isArray(update) || update.length < 2) return null;
  const data = update[0];
  const undefinedKeys = update[1];
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return [
    data as Record<string, unknown>,
    Array.isArray(undefinedKeys)
      ? undefinedKeys.filter((key): key is string => typeof key === "string")
      : [],
  ];
}

function normalizeComponentPatch(
  patch: Partial<ComponentProps> & Record<string, unknown>,
  fallbackUid: string,
): Partial<ComponentProps> & Record<string, unknown> {
  const props =
    patch.props && typeof patch.props === "object"
      ? (normalizeUidRefs(patch.props as Record<string, unknown>) as Record<
          string,
          unknown
        >)
      : undefined;
  return {
    ...patch,
    uid: normalizeLayoutUid(patch.uid ?? fallbackUid),
    props,
  };
}

function normalizeUidRefs(value: unknown): unknown {
  if (typeof value === "string") {
    return normalizeLayoutUid(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUidRefs(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = normalizeUidRefs(item);
  }
  return out;
}

export function normalizeLayoutPayload(payload: unknown): LayoutModel | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const maybeLayout = payload as Partial<LayoutModel>;
  if (maybeLayout.layout && typeof maybeLayout.layout === "object") {
    return maybeLayout as LayoutModel;
  }

  const maybeWrapped = payload as { data?: unknown };
  if (maybeWrapped.data && maybeWrapped.data !== payload) {
    return normalizeLayoutPayload(maybeWrapped.data);
  }

  return null;
}

export function LayoutRoot({ layout }: { layout: LayoutModel }) {
  if (layout.fallback) {
    return (
      <div style={{ padding: 16, color: "#a00" }}>{layout.fallback}</div>
    );
  }
  const entries = layout.layout;
  if (Object.keys(entries).length === 0) {
    return <div style={{ padding: 16 }}>Empty layout</div>;
  }
  const rootKey = findRootUid(entries);
  if (!rootKey || !entries[rootKey]) {
    return <div style={{ padding: 16 }}>Invalid layout</div>;
  }
  return (
    <div
      data-tensorpc-layout-root={rootKey}
      style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}
    >
      <ComponentNode node={entries[rootKey]} layout={entries} />
    </div>
  );
}

export type { LayoutModel, ComponentProps };
