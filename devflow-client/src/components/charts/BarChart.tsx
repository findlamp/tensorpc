import type { ReactNode } from "react";
import { BarChart as MuiBarChart } from "@mui/x-charts/BarChart";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function BarChart({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const baseSx = useFlexStyles(props);

  const series = props.series as Array<{
    data: number[];
    label?: string;
    color?: string;
  }> | undefined;
  const width = typeof props.width === "number" ? props.width : 400;
  const height = typeof props.height === "number" ? props.height : 300;

  if (!series?.length) {
    return null;
  }

  return (
    <MuiBarChart
      series={series.map((s) => ({
        data: s.data,
        label: s.label,
        color: s.color,
      }))}
      width={width}
      height={height}
      sx={baseSx}
    />
  );
}
