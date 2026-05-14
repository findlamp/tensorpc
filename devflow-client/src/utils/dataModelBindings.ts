import type { ComponentProps } from "../hooks/useLayoutModel";
import { UIType } from "../render/uiTypes";
import { childUids } from "./helpers";
import { lookupLayoutNode, normalizeLayoutUid } from "./layoutRefs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function bindingExpression(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return decodeUniqueTreeIdParts(value)?.[0] ?? value;
}

function getPath(root: unknown, path: string): unknown {
  const clean = path.trim();
  if (!clean) return undefined;
  if (clean === "getRoot()" || clean === "$") return root;
  if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(clean)) {
    return undefined;
  }
  let current: unknown = root;
  for (const part of clean.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function boolValue(value: unknown) {
  return value === true;
}

function evaluateCmCommonQuery(model: unknown, key: string): unknown {
  if (!isRecord(model)) return undefined;

  const id = stringValue(model.id);
  const curLeaderId = stringValue(model.cur_leader_id);
  const isLeader = id !== "" && id === curLeaderId;
  const isRaftNode = boolValue(model.is_raft_node);
  const worldSize = numberValue(model.world_size);
  const numConnected = numberValue(model.num_connected);
  const connectInfo = `${numConnected}/${worldSize}`;

  let header = "Worker";
  if (isRaftNode) {
    header = isLeader ? "Raft Leader" : "Raft Worker";
    if (!isLeader && typeof model.cur_leader_url === "string") {
      header += ` (leader: ${model.cur_leader_url})`;
    }
    header += ` - ${connectInfo}`;
  }

  const canWorkersRunCmd = boolValue(model.can_workers_run_cmd);
  const curWorker = isRecord(model.cur_worker) ? model.cur_worker : null;
  const terminalIsLocal = !curWorker || stringValue(curWorker.id) === id;

  const numPaused = numberValue(model.num_paused);
  const groupStatus = numberValue(model.group_ssh_status);
  const lastActivity = stringValue(model.worker_last_activity);
  let workerSelectLabel = "Workers";
  if (numPaused > 0) {
    workerSelectLabel += ` (${numPaused} paused) `;
  } else if (groupStatus === 0) {
    workerSelectLabel += " (disconnected)";
  } else if (groupStatus === 4 || groupStatus === 5) {
    workerSelectLabel += " (idle)";
  } else if (groupStatus === 2) {
    workerSelectLabel += lastActivity
      ? ` (running partial|${lastActivity})`
      : " (running partial)";
  } else {
    workerSelectLabel += lastActivity ? ` (running|${lastActivity})` : " (running)";
  }

  const values: Record<string, unknown> = {
    header,
    connect_info: connectInfo,
    is_leader: isLeader,
    start_or_cancel_icon: canWorkersRunCmd ? 14 : 16,
    not_leader_disabled: !isLeader,
    stop_btn_disabled: canWorkersRunCmd || !isLeader,
    terminal_is_local: terminalIsLocal,
    worker_select_label: workerSelectLabel,
  };
  return values[key];
}

export function evaluateBinding(model: unknown, encoded: unknown): unknown {
  if (Array.isArray(encoded) && encoded.length >= 3 && typeof encoded[1] === "string") {
    return evaluateCmCommonQuery(model, encoded[1]);
  }
  const expr = bindingExpression(encoded);
  if (!expr) return undefined;
  return getPath(model, expr);
}

function uidFromRef(value: unknown): string | undefined {
  if (typeof value === "string") return normalizeLayoutUid(value);
  if (isRecord(value)) {
    const ref = value.uid ?? value.component ?? value.compUid ?? value.child ?? value.value;
    return typeof ref === "string" ? normalizeLayoutUid(ref) : undefined;
  }
  return undefined;
}

export function componentChildUids(node: ComponentProps | undefined): string[] {
  if (!node) return [];
  const props = node.props ?? {};
  const out = new Set<string>(childUids(props));
  const complex = isRecord(props.childsComplex) ? props.childsComplex : {};

  const tabDefs = complex.tabDefs;
  if (Array.isArray(tabDefs)) {
    for (const tabDef of tabDefs) {
      const uid = isRecord(tabDef) ? uidFromRef(tabDef.component) : undefined;
      if (uid) out.add(uid);
    }
  }

  for (const key of ["before", "after"] as const) {
    const items = complex[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const uid = uidFromRef(item);
      if (uid) out.add(uid);
    }
  }

  const items = complex.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      const uid = uidFromRef(item);
      if (uid) out.add(uid);
    }
  }

  return [...out];
}

export function buildParentMap(layout: Record<string, ComponentProps>) {
  const parents = new Map<string, string>();
  for (const [uid, node] of Object.entries(layout)) {
    for (const childUid of componentChildUids(node)) {
      parents.set(normalizeLayoutUid(childUid), normalizeLayoutUid(uid));
    }
  }
  return parents;
}

export function nearestDataModel(
  uid: string | undefined,
  layout: Record<string, ComponentProps>,
  parents = buildParentMap(layout),
) {
  if (!uid) return undefined;
  let cursor: string | undefined = normalizeLayoutUid(uid);
  while (cursor) {
    const node = lookupLayoutNode(layout, cursor);
    if (node?.type === UIType.DataModel) return node;
    cursor = parents.get(cursor);
  }
  return undefined;
}

function dataModelByUid(
  uid: unknown,
  fallbackUid: string,
  layout: Record<string, ComponentProps>,
  parents: Map<string, string>,
) {
  if (typeof uid === "string" && uid) {
    const direct = lookupLayoutNode(layout, uid);
    if (direct) return direct;
  }
  return nearestDataModel(fallbackUid, layout, parents);
}

function splitDirectBinding(value: unknown): { dmUid?: unknown; encoded: unknown } {
  if (Array.isArray(value) && value.length === 2) {
    return { dmUid: value[0], encoded: value[1] };
  }
  return { encoded: value };
}

export function resolvePropsFromDataModel(
  uid: string,
  node: ComponentProps,
  layout: Record<string, ComponentProps>,
): Record<string, unknown> {
  const out = { ...(node.props ?? {}) };
  const parents = buildParentMap(layout);
  const nodeMeta = node as ComponentProps & {
    dmProps?: unknown;
    dmPropsGrouped?: unknown;
  };

  if (Array.isArray(nodeMeta.dmPropsGrouped)) {
    for (const group of nodeMeta.dmPropsGrouped) {
      if (!Array.isArray(group) || group.length < 2 || !Array.isArray(group[1])) continue;
      const dm = dataModelByUid(group[0], uid, layout, parents);
      const model = dm?.props?.dataObject;
      for (const pair of group[1]) {
        if (!Array.isArray(pair) || pair.length < 2 || typeof pair[0] !== "string") {
          continue;
        }
        const value = evaluateBinding(model, pair[1]);
        if (value !== undefined) out[pair[0]] = value;
      }
    }
  }

  if (isRecord(nodeMeta.dmProps)) {
    for (const [key, rawBinding] of Object.entries(nodeMeta.dmProps)) {
      const binding = splitDirectBinding(rawBinding);
      const dm = dataModelByUid(binding.dmUid, uid, layout, parents);
      const value = evaluateBinding(dm?.props?.dataObject, binding.encoded);
      if (value !== undefined) out[key] = value;
    }
  }

  return out;
}
