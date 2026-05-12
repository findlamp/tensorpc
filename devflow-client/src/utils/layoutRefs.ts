import type { ComponentProps } from "../hooks/useLayoutModel";

const UNIQUE_TREE_REF_RE = /^UniqueTreeIdForComp\((.*)\)$/;
const TEMPLATE_SPLIT = "$&&";

export function normalizeLayoutUid(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "");
  const match = value.match(UNIQUE_TREE_REF_RE);
  return match?.[1] ?? value;
}

export function patchLayoutUidWithPrefixes(
  value: unknown,
  prefixes?: unknown,
): string {
  const uid = normalizeLayoutUid(value);
  if (!Array.isArray(prefixes) || prefixes.length === 0 || !uid) return uid;

  const prefixParts = prefixes.map((part) => String(part)).filter(Boolean);
  if (prefixParts.length === 0) return uid;

  const templateIndex = uid.indexOf(TEMPLATE_SPLIT);
  const baseUid = templateIndex >= 0 ? uid.slice(0, templateIndex) : uid;
  const templateSuffix = templateIndex >= 0 ? uid.slice(templateIndex) : "";
  const prefixUid = prefixParts.join(".");

  if (!baseUid || baseUid === prefixUid || baseUid.startsWith(`${prefixUid}.`)) {
    return uid;
  }
  return `${prefixUid}.${baseUid}${templateSuffix}`;
}

export function lookupLayoutNode(
  layout: Record<string, ComponentProps>,
  value: unknown,
): ComponentProps | undefined {
  const raw = typeof value === "string" ? value : String(value ?? "");
  if (!raw) return undefined;
  return layout[raw] ?? layout[normalizeLayoutUid(raw)];
}
