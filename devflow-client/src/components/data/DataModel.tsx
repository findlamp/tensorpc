import type { ReactNode } from "react";
import type { ComponentProps } from "../../hooks/useLayoutModel";
import { Fragment } from "../special/Fragment";
import { isPerfMonitorDataModel, PerfMonitorViewer } from "../viewers/PerfMonitorViewer";

export function DataModel({
  props,
  layout,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
  children: ReactNode[];
}) {
  if (isPerfMonitorDataModel(props)) {
    return <PerfMonitorViewer props={props} layout={layout} children={children} />;
  }
  return <Fragment props={props} layout={layout} children={children} />;
}
