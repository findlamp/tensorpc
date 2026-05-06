export type ComponentProps = {
  uid?: unknown;
  type: number;
  props: Record<string, unknown>;
  usedEvents?: unknown[];
  dmProps?: unknown;
};

export type LayoutModel = {
  layout: Record<string, ComponentProps>;
  enableEditor?: boolean;
  fallback?: string;
  zIndex?: number;
};
