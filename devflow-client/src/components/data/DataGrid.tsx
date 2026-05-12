import type { CSSProperties, ReactNode } from "react";
import { ComponentNode } from "../ComponentNode";
import type { ComponentProps } from "../../hooks/useLayoutModel";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { lookupLayoutNode } from "../../utils/layoutRefs";

type ColumnDef = {
  header?: unknown;
  accessorKey?: unknown;
  id?: unknown;
  width?: unknown;
  align?: unknown;
  cell?: unknown;
  columns?: ColumnDef[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function columnId(column: ColumnDef, index: number) {
  return String(column.id ?? column.accessorKey ?? column.header ?? index);
}

function columnLabel(column: ColumnDef, index: number) {
  return String(column.header ?? column.accessorKey ?? column.id ?? index);
}

function flattenColumns(columns: ColumnDef[]): ColumnDef[] {
  return columns.flatMap((column) =>
    Array.isArray(column.columns) && column.columns.length > 0
      ? flattenColumns(column.columns)
      : [column],
  );
}

function rowsFromDataList(dataList: unknown): unknown[] {
  if (Array.isArray(dataList)) return dataList;
  if (isRecord(dataList) && Array.isArray(dataList.dataList)) {
    return dataList.dataList;
  }
  return [];
}

function cellText(row: unknown, column: ColumnDef, rowIndex: number) {
  if (!isRecord(row)) return String(row ?? "");
  const key = column.accessorKey ?? column.id ?? column.header;
  if (typeof key !== "string") return String(rowIndex);
  const value = row[key];
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function widthStyle(width: unknown): CSSProperties["width"] {
  if (typeof width === "number") return width;
  if (typeof width === "string" && width.length > 0) return width;
  return undefined;
}

function alignStyle(align: unknown): CSSProperties["textAlign"] {
  if (
    align === "center" ||
    align === "left" ||
    align === "right" ||
    align === "justify"
  ) {
    return align;
  }
  return undefined;
}

export function DataGrid({
  props,
  layout,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const complex = isRecord(props.childsComplex) ? props.childsComplex : {};
  const columns = flattenColumns(
    Array.isArray(complex.columnDefs) ? (complex.columnDefs as ColumnDef[]) : [],
  );
  const rows = rowsFromDataList(props.dataList);
  const customPaginationFooters = Array.isArray(complex.customPaginationFooters)
    ? complex.customPaginationFooters
    : [];
  const visibleRows = rows.slice(0, 200);
  const isCheckpointGrid =
    columns.length === 5 &&
    ["name", "type", "step", "size", "actions"].every(
      (label, index) => columnLabel(columns[index], index) === label,
    ) &&
    customPaginationFooters.length > 0;
  const renderFooter = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {customPaginationFooters.map((uid, index) => {
        const child = lookupLayoutNode(layout, uid);
        return child ? (
          <ComponentNode key={String(uid)} node={child} layout={layout} />
        ) : (
          <span key={index} />
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        ...sx,
        position: isCheckpointGrid ? "absolute" : sx.position,
        inset: isCheckpointGrid ? 0 : undefined,
        width: sx.width ?? "100%",
        height: isCheckpointGrid ? undefined : sx.height ?? "100%",
        maxHeight: sx.maxHeight,
        minWidth: sx.minWidth ?? 0,
        minHeight: sx.minHeight ?? 0,
        display: "flex",
        flexDirection: "column",
        flexFlow: "column nowrap",
        overflow: "hidden",
        borderTop: "1px solid var(--td-border)",
        background: "var(--td-bg)",
        color: "var(--td-text)",
        fontSize: 12,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          background: "var(--td-bg)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: props.tableLayout === "fixed" ? "fixed" : "auto",
          }}
        >
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={columnId(column, index)}
                  style={{
                    width: widthStyle(column.width),
                    textAlign: alignStyle(column.align) ?? "left",
                    height: 32,
                    padding: "0 12px",
                    borderBottom: "1px solid var(--td-border)",
                    color: "var(--td-text)",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    position: props.stickyHeader === true ? "sticky" : undefined,
                    top: props.stickyHeader === true ? 0 : undefined,
                    background: "var(--td-surface)",
                    zIndex: 1,
                  }}
                >
                  {columnLabel(column, index)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={isRecord(row) && props.idKey ? String(row[String(props.idKey)]) : rowIndex}>
                {columns.map((column, columnIndex) => (
                  <td
                    key={columnId(column, columnIndex)}
                    style={{
                      height: props.size === "small" ? 28 : 34,
                      padding: "0 12px",
                      borderBottom: "1px solid var(--td-border)",
                      textAlign: alignStyle(column.align),
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {cellText(row, column, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(columns.length, 1)}
                  style={{
                    height: 0,
                    padding: 0,
                    color: "var(--td-text-muted)",
                    textAlign: "center",
                    borderBottom: "1px solid var(--td-border)",
                  }}
                >
                  {columns.length === 0 ? "No columns" : ""}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div
        style={{
          minHeight: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "0 12px",
          borderTop: "1px solid var(--td-border)",
          color: "var(--td-text-muted)",
          background: "var(--td-bg)",
          flexShrink: 0,
        }}
      >
        {renderFooter()}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span>Rows per page: 10</span>
          <span>
            {rows.length === 0
              ? "0-0 of 0"
              : `1-${Math.min(10, rows.length)} of ${rows.length}`}
          </span>
          <span style={{ color: "var(--td-text-muted)" }}>{"|<  <  >  >|"}</span>
        </div>
      </div>
    </div>
  );
}
