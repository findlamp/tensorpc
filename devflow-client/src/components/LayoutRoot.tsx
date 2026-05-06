import type { AppEventMessage } from "../core/tensorPcWs";
import { AppEventType } from "../core/socketTypes";
import { ComponentNode } from "../components/ComponentNode";
import type { ComponentProps, LayoutModel } from "../hooks/useLayoutModel";

function childUids(props: Record<string, unknown>): string[] {
  const c = props.childs;
  if (!Array.isArray(c)) return [];
  return c.map((x) => (typeof x === "string" ? x : String(x)));
}

function findRootUid(layout: Record<string, ComponentProps>): string | null {
  const referenced = new Set<string>();
  for (const c of Object.values(layout)) {
    for (const uid of childUids(c.props ?? {})) {
      referenced.add(uid);
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
): LayoutModel | null {
  if (!layout || !payload || typeof payload !== "object") return layout;
  const event = payload as { new?: unknown; del?: unknown };
  const nextEntries = { ...layout.layout };
  if (Array.isArray(event.del)) {
    for (const uid of event.del) {
      delete nextEntries[String(uid)];
    }
  }
  if (event.new && typeof event.new === "object") {
    for (const [uid, update] of Object.entries(event.new as Record<string, unknown>)) {
      if (!update || typeof update !== "object") continue;
      const current = nextEntries[uid];
      const patch = update as Partial<ComponentProps> & Record<string, unknown>;
      if (typeof patch.type === "number" && patch.props && typeof patch.props === "object") {
        nextEntries[uid] = patch as ComponentProps;
      } else if (current) {
        nextEntries[uid] = {
          ...current,
          props: {
            ...current.props,
            ...(patch.props && typeof patch.props === "object" ? patch.props : patch),
          },
        };
      }
    }
  }
  return { ...layout, layout: nextEntries };
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
  return <ComponentNode node={entries[rootKey]} layout={entries} />;
}

export type { LayoutModel, ComponentProps };
