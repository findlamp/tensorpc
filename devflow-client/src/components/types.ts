/** ============================================================
 * Typed prop interfaces for every UIType component.
 * These replace the untyped Record<string, unknown> props.
 * ============================================================ */

// ── CSS Dimension helpers ──
export type Dimension = string | number;

// ── Common Flex / Box / Positioning props (shared by FlexBox, Paper, Card, etc.) ──
export interface FlexComponentBaseProps {
  width?: Dimension;
  height?: Dimension;
  minWidth?: Dimension;
  minHeight?: Dimension;
  maxWidth?: Dimension;
  maxHeight?: Dimension;
  margin?: Dimension;
  marginTop?: Dimension;
  marginBottom?: Dimension;
  marginLeft?: Dimension;
  marginRight?: Dimension;
  padding?: Dimension;
  paddingTop?: Dimension;
  paddingBottom?: Dimension;
  paddingLeft?: Dimension;
  paddingRight?: Dimension;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: Dimension;
  flex?: Dimension;
  alignSelf?: React.CSSProperties["alignSelf"];
  alignItems?: React.CSSProperties["alignItems"];
  justifyContent?: React.CSSProperties["justifyContent"];
  flexDirection?: React.CSSProperties["flexDirection"];
  flexWrap?: React.CSSProperties["flexWrap"];
  flexFlow?: React.CSSProperties["flexFlow"];
  gap?: Dimension;
  overflow?: React.CSSProperties["overflow"];
  overflowX?: React.CSSProperties["overflowX"];
  overflowY?: React.CSSProperties["overflowY"];
  position?: React.CSSProperties["position"];
  left?: Dimension;
  top?: Dimension;
  right?: Dimension;
  bottom?: Dimension;
  zIndex?: number;
  backgroundColor?: string;
  background?: string;
  color?: string;
  border?: string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderColor?: string;
  borderRadius?: Dimension;
  className?: string;
  fontSize?: Dimension;
  fontFamily?: string;
  textAlign?: React.CSSProperties["textAlign"];
  cursor?: React.CSSProperties["cursor"];
  display?: React.CSSProperties["display"];
  whiteSpace?: React.CSSProperties["whiteSpace"];
  wordBreak?: React.CSSProperties["wordBreak"];
  textOverflow?: React.CSSProperties["textOverflow"];
  pointerEvents?: React.CSSProperties["pointerEvents"];
  transform?: React.CSSProperties["transform"];
  boxShadow?: string;
  outline?: string;
}

// ── Shared children / icon / color / disabled props ──
export interface ChildrenProps {
  childs?: (string | number)[];
}

export type MuiColor =
  | "primary"
  | "secondary"
  | "error"
  | "info"
  | "success"
  | "warning";

export type MuiSize = "small" | "medium" | "large";

export type MuiVariant = "contained" | "outlined" | "text";
export type MuiInputVariant = "filled" | "outlined" | "standard";

// ── Layout Containers ──

export interface FlexBoxProps extends FlexComponentBaseProps, ChildrenProps {}

export interface PaperProps extends FlexComponentBaseProps, ChildrenProps {
  elevation?: number;
  variant?: "elevation" | "outlined";
  square?: boolean;
}

export interface CardProps extends FlexComponentBaseProps, ChildrenProps {
  title?: string;
}

export interface CollapseProps extends FlexComponentBaseProps, ChildrenProps {
  triggered?: boolean;
  orientation?: "horizontal" | "vertical";
  timeout?: number;
  collapsedSize?: number;
  unmountOnExit?: boolean;
}

export interface DialogProps extends FlexComponentBaseProps, ChildrenProps {
  open?: boolean;
  fullScreen?: boolean;
  fullWidth?: boolean;
  dialogMaxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  scroll?: "body" | "paper";
  title?: string;
  dividers?: boolean;
}

export interface TooltipFlexBoxProps
  extends FlexComponentBaseProps,
    ChildrenProps {
  title?: string;
  placement?: "top" | "right" | "left" | "bottom";
  arrow?: boolean;
  followCursor?: boolean;
}

// ── Accordion Family ──

export interface AccordionProps extends FlexComponentBaseProps, ChildrenProps {
  expanded?: boolean;
  disabled?: boolean;
  square?: boolean;
  disableGutters?: boolean;
}

export interface AccordionSummaryProps
  extends FlexComponentBaseProps,
    ChildrenProps {}

export interface AccordionDetailProps
  extends FlexComponentBaseProps,
    ChildrenProps {}

// ── Buttons ──

export interface ButtonProps extends FlexComponentBaseProps {
  variant?: MuiVariant;
  muiColor?: MuiColor;
  disabled?: boolean;
  size?: MuiSize;
  fullWidth?: boolean;
  loading?: boolean;
  name?: string;
}

export interface ButtonGroupProps extends FlexComponentBaseProps, ChildrenProps {
  variant?: MuiVariant;
}

export interface ToggleButtonProps extends FlexComponentBaseProps {
  size?: MuiSize;
  icon?: unknown;
  label?: string;
}

export interface ToggleButtonGroupProps
  extends FlexComponentBaseProps,
    ChildrenProps {}

export interface IconButtonProps extends FlexComponentBaseProps {
  size?: MuiSize;
  muiColor?: MuiColor;
  disabled?: boolean;
  icon?: unknown;
  tooltip?: string;
}

// ── Inputs ──

export interface TextFieldProps extends FlexComponentBaseProps {
  label?: string;
  value?: unknown;
  placeholder?: string;
  size?: "small" | "medium";
  variant?: MuiInputVariant;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  error?: boolean;
  fullWidth?: boolean;
  type?: string;
  required?: boolean;
  muiColor?: MuiColor | MuiColor;
}

export interface InputProps extends FlexComponentBaseProps {
  value?: unknown;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: string;
  required?: boolean;
}

export interface SelectProps extends FlexComponentBaseProps {
  value?: unknown;
  label?: string;
  size?: "small" | "medium";
  items?: [string, unknown][];
}

export interface MultipleSelectProps extends FlexComponentBaseProps {
  values?: unknown[];
  label?: string;
  size?: "small" | "medium";
  items?: [string, unknown][];
}

export interface SwitchProps extends FlexComponentBaseProps {
  checked?: boolean;
  disabled?: boolean;
  size?: MuiSize;
  muiColor?: MuiColor;
  label?: string;
  labelPlacement?: "top" | "start" | "bottom" | "end";
}

export interface CheckboxProps extends FlexComponentBaseProps {
  checked?: boolean;
  disabled?: boolean;
  size?: MuiSize;
  muiColor?: MuiColor;
  label?: string;
  labelPlacement?: "top" | "start" | "bottom" | "end";
}

export interface RadioGroupProps extends FlexComponentBaseProps {
  value?: unknown;
  row?: boolean;
  names?: string[];
}

export interface SliderProps extends FlexComponentBaseProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  size?: MuiSize;
  muiColor?: "primary" | "secondary";
  vertical?: boolean;
}

export interface ChipProps extends FlexComponentBaseProps {
  label?: string;
  icon?: unknown;
  muiColor?: "default" | MuiColor;
  size?: MuiSize;
  variant?: "filled" | "outlined";
  clickable?: boolean;
  deletable?: boolean;
}

// ── Display ──

export interface TypographyProps extends FlexComponentBaseProps {
  variant?:
    | "body1"
    | "body2"
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "caption"
    | "overline"
    | "subtitle1"
    | "subtitle2";
  muiColor?: string;
  align?: "center" | "inherit" | "justify" | "left" | "right";
  gutterBottom?: boolean;
  noWrap?: boolean;
  value?: unknown;
}

export interface IconCompProps {
  icon?: unknown;
  tooltip?: string;
  iconFontSize?: Dimension;
  color?: string;
}

export interface DividerProps extends FlexComponentBaseProps {
  orientation?: "horizontal" | "vertical";
}

export interface LinkProps extends FlexComponentBaseProps {
  href?: string;
  underline?: "always" | "hover" | "none";
  variant?: string;
  muiColor?: string;
  value?: unknown;
}

export interface ImageProps extends FlexComponentBaseProps {
  image?: string;
  alt?: string;
}

export interface AlertProps extends FlexComponentBaseProps {
  severity?: "error" | "warning" | "success" | "info";
  variant?: "filled" | "outlined" | "standard";
  muiColor?: "error" | "warning" | "success" | "info";
  title?: string;
  value?: unknown;
}

export interface CircularProgressProps extends FlexComponentBaseProps {
  variant?: "determinate" | "indeterminate";
  value?: number;
  muiColor?: MuiColor;
  size?: Dimension;
  thickness?: number;
}

export interface LinearProgressProps extends FlexComponentBaseProps {
  variant?: "determinate" | "indeterminate" | "buffer" | "query";
  value?: number;
  valueBuffer?: number;
  muiColor?: MuiColor;
}

export interface IFrameProps extends FlexComponentBaseProps {
  url?: string;
  title?: string;
}

export interface PaginationProps extends FlexComponentBaseProps {
  count?: number;
  value?: number;
  muiColor?: "primary" | "secondary" | "standard";
  size?: MuiSize;
  variant?: "text" | "outlined";
  shape?: "circular" | "rounded";
  disabled?: boolean;
  hideNextButton?: boolean;
  hidePrevButton?: boolean;
  showFirstButton?: boolean;
  showLastButton?: boolean;
  siblingCount?: number;
  boundaryCount?: number;
}

// ── List Family ──

export interface MUIListProps extends FlexComponentBaseProps, ChildrenProps {
  dense?: boolean;
  disablePadding?: boolean;
  subheader?: string;
}

export interface ListItemButtonProps
  extends FlexComponentBaseProps,
    ChildrenProps {
  dense?: boolean;
  disabled?: boolean;
  disableGutters?: boolean;
  divider?: boolean;
  selected?: boolean;
  alignItems?: "center" | "flex-start";
}

export interface ListItemTextProps extends FlexComponentBaseProps {
  value?: unknown;
  secondary?: string;
  inset?: boolean;
  disableTypography?: boolean;
}

export interface ListItemIconProps extends FlexComponentBaseProps, ChildrenProps {
  icon?: unknown;
}

export interface MenuListProps extends FlexComponentBaseProps, ChildrenProps {
  menuItems?: Array<{ id: string; label?: string }>;
}

// ── Tabs ──

export interface TabDef {
  label: string;
  value: string;
  component: unknown;
}

export interface TabsProps extends FlexComponentBaseProps {
  value?: unknown;
  orientation?: "horizontal" | "vertical";
  variant?: "scrollable" | "fullWidth" | "standard";
  textColor?: "inherit" | "primary" | "secondary";
  indicatorColor?: "primary" | "secondary";
  centered?: boolean;
  childsComplex?: {
    tabDefs?: TabDef[];
    [key: string]: unknown;
  };
}

// ── Breadcrumbs ──

export interface BreadcrumbsProps extends FlexComponentBaseProps {
  maxItems?: number;
  itemsAfterCollapse?: number;
  itemsBeforeCollapse?: number;
  value?: string[];
}

// ── Theme / Utils ──

export interface ThemeProviderProps extends FlexComponentBaseProps, ChildrenProps {}

// ── Charts (MUI X Charts) ──

export interface BarChartProps extends FlexComponentBaseProps {
  xAxis?: unknown[];
  series?: Array<{ data: number[]; label?: string; color?: string }>;
  width?: number;
  height?: number;
}

export interface LineChartProps extends FlexComponentBaseProps {
  xAxis?: unknown[];
  series?: Array<{ data: number[]; label?: string; color?: string }>;
  width?: number;
  height?: number;
}

export interface ScatterChartProps extends FlexComponentBaseProps {
  series?: Array<{ data: [number, number][]; label?: string }>;
  width?: number;
  height?: number;
}

// ── Three.js (stub types) ──

export interface ThreeCanvasProps extends FlexComponentBaseProps, ChildrenProps {}

// ── Markdown ──

export interface MarkdownProps extends FlexComponentBaseProps {
  value?: string;
}

// ── Monaco / Code Editor ──

export interface MonacoEditorProps extends FlexComponentBaseProps {
  value?: string;
  language?: string;
  readOnly?: boolean;
}

// ── Union of all typed props (for generic dispatch) ──
export type AnyComponentProps =
  | FlexBoxProps
  | PaperProps
  | CardProps
  | CollapseProps
  | DialogProps
  | TooltipFlexBoxProps
  | AccordionProps
  | AccordionSummaryProps
  | AccordionDetailProps
  | ButtonProps
  | ButtonGroupProps
  | ToggleButtonProps
  | ToggleButtonGroupProps
  | IconButtonProps
  | TextFieldProps
  | InputProps
  | SelectProps
  | MultipleSelectProps
  | SwitchProps
  | CheckboxProps
  | RadioGroupProps
  | SliderProps
  | ChipProps
  | TypographyProps
  | IconCompProps
  | DividerProps
  | LinkProps
  | ImageProps
  | AlertProps
  | CircularProgressProps
  | LinearProgressProps
  | IFrameProps
  | PaginationProps
  | MUIListProps
  | ListItemButtonProps
  | ListItemTextProps
  | ListItemIconProps
  | MenuListProps
  | TabsProps
  | BreadcrumbsProps
  | ThemeProviderProps
  | BarChartProps
  | LineChartProps
  | ScatterChartProps
  | ThreeCanvasProps
  | MarkdownProps
  | MonacoEditorProps;
