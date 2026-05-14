import type { ReactNode, ComponentType } from "react";
import { Suspense, lazy } from "react";
import { UIType } from "../render/uiTypes";
import type { ComponentProps } from "../hooks/useLayoutModel";

// Layout - eagerly loaded
import { Allotment } from "./layout/Allotment";
import { FlexBox } from "./layout/FlexBox";
import { FlexLayout } from "./layout/FlexLayout";
import { Paper } from "./layout/Paper";
import { Card } from "./layout/Card";
import { Collapse } from "./layout/Collapse";
import { Dialog } from "./layout/Dialog";
import { TooltipFlexBox } from "./layout/TooltipFlexBox";
import { ThemeProvider } from "./layout/ThemeProvider";
import { Accordion } from "./layout/Accordion";
import { AccordionSummary } from "./layout/AccordionSummary";
import { AccordionDetail } from "./layout/AccordionDetail";
import { AppBar } from "./layout/AppBar";
import { Toolbar } from "./layout/Toolbar";
import { Drawer } from "./layout/Drawer";
import { DockViewLayout } from "./layout/DockViewLayout";

// Buttons
import { Button } from "./buttons/Button";
import { ButtonGroup } from "./buttons/ButtonGroup";
import { ToggleButton } from "./buttons/ToggleButton";
import { ToggleButtonGroup } from "./buttons/ToggleButtonGroup";
import { IconButton } from "./buttons/IconButton";

// Inputs
import { CompTextField } from "./inputs/TextField";
import { Input } from "./inputs/Input";
import { Select } from "./inputs/Select";
import { MultipleSelect } from "./inputs/MultipleSelect";
import { Switch } from "./inputs/Switch";
import { Checkbox } from "./inputs/Checkbox";
import { RadioGroup } from "./inputs/RadioGroup";
import { Slider } from "./inputs/Slider";
import { Chip } from "./inputs/Chip";
import { AutoComplete } from "./inputs/AutoComplete";
import { MultipleAutoComplete } from "./inputs/MultipleAutoComplete";
import { BlenderSlider } from "./inputs/BlenderSlider";
import { NumberField } from "./inputs/NumberField";
import { SimpleControls } from "./inputs/SimpleControls";

// Display
import { Typography } from "./display/Typography";
import { IconComp } from "./display/Icon";
import { CompDivider } from "./display/Divider";
import { Link } from "./display/Link";
import { Image } from "./display/Image";
import { Alert } from "./display/Alert";
import { CircularProgress } from "./display/CircularProgress";
import { LinearProgress } from "./display/LinearProgress";
import { IFrame } from "./display/IFrame";
import { Pagination } from "./display/Pagination";
import { Markdown } from "./display/Markdown";

// List
import { MUIListComp } from "./list/MUIList";
import { ListItemButton } from "./list/ListItemButton";
import { ListItemText } from "./list/ListItemText";
import { ListItemIconComp } from "./list/ListItemIcon";
import { Breadcrumbs } from "./list/Breadcrumbs";
import { Tabs } from "./list/Tabs";
import { MenuListContent } from "./list/MenuList";
import { ThreeNode } from "./three/ThreeNode";

// Charts - lazy loaded
const LazyBarChart = lazy(() => import("./charts/BarChart").then((m) => ({ default: m.BarChart })));
const LazyLineChart = lazy(() => import("./charts/LineChart").then((m) => ({ default: m.LineChart })));
const LazyScatterChart = lazy(() => import("./charts/ScatterChart").then((m) => ({ default: m.ScatterChart })));
const LazyPlotly = lazy(() => import("./charts/Plotly").then((m) => ({ default: m.Plotly })));

// Three.js lazy loaded
const LazyThreeCanvas = lazy(() => import("./three/ThreeCanvas").then((m) => ({ default: m.ThreeCanvas })));

// Heavy editor lazy loaded
const LazyMonacoEditor = lazy(() =>
  import("./viewers/MonacoEditor").then((m) => ({ default: m.MonacoEditor })),
);

// Viewers
import { JsonViewer } from "./viewers/JsonViewer";
import { JsonFastViewer } from "./viewers/JsonFastViewer";
import { SimpleEditor } from "./viewers/SimpleEditor";
import { VideoPlayer } from "./viewers/VideoPlayer";
import { Terminal } from "./viewers/Terminal";
import { AppTerminal } from "./viewers/AppTerminal";
import { DataModel } from "./data/DataModel";

// Data model stubs
import { DataGrid } from "./data/DataGrid";
import { DataFlexBox } from "./data/DataFlexBox";
import { MatrixDataGrid } from "./data/MatrixDataGrid";
import { TanstackJsonLikeTree } from "./data/TanstackJsonLikeTree";

// Flow stubs
import { Flow } from "./flow/Flow";
import { FlowMiniMap } from "./flow/FlowMiniMap";
import { FlowControls } from "./flow/FlowControls";
import { FlowBackground } from "./flow/FlowBackground";
import { FlowHandle } from "./flow/FlowHandle";
import { FlowNodeResizer } from "./flow/FlowNodeResizer";
import { FlowNodeToolbar } from "./flow/FlowNodeToolbar";

// Leaflet stubs
import { LeafletMapContainer } from "./leaflet/LeafletMapContainer";
import { LeafletTileLayer } from "./leaflet/LeafletTileLayer";
import { LeafletMarker } from "./leaflet/LeafletMarker";

// UIKit stubs
import { UIKitRoot } from "./uikit/UIKitRoot";

// Special components
import { Fragment } from "./special/Fragment";
import { MatchCase } from "./special/MatchCase";

export type ComponentRenderFn = ComponentType<{
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
  children: ReactNode[];
}>;

function withSuspense(
  LazyComp: ComponentType<any>,
): ComponentRenderFn {
  return function SuspenseWrapper(inProps: {
    props: Record<string, unknown>;
    layout: Record<string, ComponentProps>;
    children: ReactNode[];
  }) {
    const Comp = LazyComp as ComponentType<typeof inProps>;
    return (
      <Suspense fallback={<div style={{ padding: 8, color: "#666" }}>Loading...</div>}>
        <Comp {...inProps} />
      </Suspense>
    );
  };
}

export const COMPONENT_REGISTRY: Record<number, ComponentRenderFn> = {
  // Layout
  [UIType.Allotment]: Allotment,
  [UIType.FlexLayout]: FlexLayout,
  [UIType.DockViewLayout]: DockViewLayout,
  [UIType.FlexBox]: FlexBox,
  [UIType.Paper]: Paper,
  [UIType.Card]: Card,
  [UIType.Collapse]: Collapse,
  [UIType.Dialog]: Dialog,
  [UIType.TooltipFlexBox]: TooltipFlexBox,
  [UIType.ThemeProvider]: ThemeProvider,
  [UIType.Accordion]: Accordion,
  [UIType.AccordionSummary]: AccordionSummary,
  [UIType.AccordionDetail]: AccordionDetail,
  [UIType.AppBar]: AppBar,
  [UIType.Toolbar]: Toolbar,
  [UIType.Drawer]: Drawer,

  // Buttons
  [UIType.Button]: Button,
  [UIType.ButtonGroup]: ButtonGroup,
  [UIType.ToggleButton]: ToggleButton,
  [UIType.ToggleButtonGroup]: ToggleButtonGroup,
  [UIType.IconButton]: IconButton,

  // Inputs
  [UIType.TextField]: CompTextField,
  [UIType.Input]: Input,
  [UIType.Select]: Select,
  [UIType.MultipleSelect]: MultipleSelect,
  [UIType.Switch]: Switch,
  [UIType.Checkbox]: Checkbox,
  [UIType.RadioGroup]: RadioGroup,
  [UIType.Slider]: Slider,
  [UIType.Chip]: Chip,
  [UIType.AutoComplete]: AutoComplete,
  [UIType.MultipleAutoComplete]: MultipleAutoComplete,
  [UIType.BlenderSlider]: BlenderSlider,
  [UIType.NumberField]: NumberField,
  [UIType.SimpleControls]: SimpleControls,

  // Display
  [UIType.Typography]: Typography,
  [UIType.Icon]: IconComp,
  [UIType.Divider]: CompDivider,
  [UIType.Link]: Link,
  [UIType.Image]: Image,
  [UIType.Alert]: Alert,
  [UIType.CircularProgress]: CircularProgress,
  [UIType.LinearProgress]: LinearProgress,
  [UIType.IFrame]: IFrame,
  [UIType.Pagination]: Pagination,
  [UIType.Markdown]: Markdown,

  // List
  [UIType.MUIList]: MUIListComp,
  [UIType.ListItemButton]: ListItemButton,
  [UIType.ListItemText]: ListItemText,
  [UIType.ListItemIcon]: ListItemIconComp,
  [UIType.Breadcrumbs]: Breadcrumbs,
  [UIType.Tabs]: Tabs,
  [UIType.MenuList]: MenuListContent,

  // Charts (lazy)
  [UIType.MUIBarChart]: withSuspense(LazyBarChart),
  [UIType.MUILineChart]: withSuspense(LazyLineChart),
  [UIType.MUIScatterChart]: withSuspense(LazyScatterChart),
  [UIType.Plotly]: withSuspense(LazyPlotly),

  // Three.js (lazy)
  [UIType.ThreeCanvas]: withSuspense(LazyThreeCanvas),
  [UIType.ThreePoints]: ThreeNode,
  [UIType.ThreePerspectiveCamera]: ThreeNode,
  [UIType.ThreeGroup]: ThreeNode,
  [UIType.ThreeOrthographicCamera]: ThreeNode,
  [UIType.ThreeFlex]: ThreeNode,
  [UIType.ThreeFlexItemBox]: ThreeNode,
  [UIType.ThreeHtml]: ThreeNode,
  [UIType.ThreeHud]: ThreeNode,
  [UIType.ThreeView]: ThreeNode,
  [UIType.ThreeMapControl]: ThreeNode,
  [UIType.ThreeOrbitControl]: ThreeNode,
  [UIType.ThreePointerLockControl]: ThreeNode,
  [UIType.ThreeFirstPersonControl]: ThreeNode,
  [UIType.ThreeTransformControl]: ThreeNode,
  [UIType.ThreeCameraControl]: ThreeNode,
  [UIType.ThreePivotControl]: ThreeNode,
  [UIType.ThreeBoundingBox]: ThreeNode,
  [UIType.ThreeAxesHelper]: ThreeNode,
  [UIType.ThreeInfiniteGridHelper]: ThreeNode,
  [UIType.ThreeSegments]: ThreeNode,
  [UIType.ThreeImage]: ThreeNode,
  [UIType.ThreeBoxes2D]: ThreeNode,
  [UIType.ThreeText]: ThreeNode,
  [UIType.ThreeMeshMaterial]: ThreeNode,
  [UIType.ThreeMesh]: ThreeNode,
  [UIType.ThreeBufferGeometry]: ThreeNode,
  [UIType.ThreeFlexAutoReflow]: ThreeNode,
  [UIType.ThreeLine]: ThreeNode,
  [UIType.ThreeFlexManualReflow]: ThreeNode,
  [UIType.ThreeScreenShot]: ThreeNode,
  [UIType.ThreePointLight]: ThreeNode,
  [UIType.ThreeDirectionalLight]: ThreeNode,
  [UIType.ThreeSpotLight]: ThreeNode,
  [UIType.ThreeAmbientLight]: ThreeNode,
  [UIType.ThreeHemisphereLight]: ThreeNode,
  [UIType.ThreePrimitiveMesh]: ThreeNode,
  [UIType.ThreeEdges]: ThreeNode,
  [UIType.ThreeBufferMesh]: ThreeNode,
  [UIType.ThreeVoxelMesh]: ThreeNode,
  [UIType.ThreeInstancedMesh]: ThreeNode,
  [UIType.ThreeSky]: ThreeNode,
  [UIType.ThreeEnvironment]: ThreeNode,
  [UIType.ThreeWireframe]: ThreeNode,
  [UIType.ThreeLightFormer]: ThreeNode,
  [UIType.ThreeAccumulativeShadows]: ThreeNode,
  [UIType.ThreeRandomizedLight]: ThreeNode,
  [UIType.ThreeBVH]: ThreeNode,
  [UIType.ThreeCubeCamera]: ThreeNode,
  [UIType.ThreeContactShadows]: ThreeNode,
  [UIType.ThreeGizmoHelper]: ThreeNode,
  [UIType.ThreeSelectionContext]: ThreeNode,
  [UIType.ThreeOutlines]: ThreeNode,
  [UIType.ThreeInstancedBufferMesh]: ThreeNode,
  [UIType.ThreeDataListGroup]: ThreeNode,
  [UIType.ThreeHudGroup]: ThreeNode,
  [UIType.ThreeMeshBasicMaterial]: ThreeNode,
  [UIType.ThreeMeshStandardMaterial]: ThreeNode,
  [UIType.ThreeMeshLambertMaterial]: ThreeNode,
  [UIType.ThreeMeshMatcapMaterial]: ThreeNode,
  [UIType.ThreeMeshNormalMaterial]: ThreeNode,
  [UIType.ThreeMeshPhongMaterial]: ThreeNode,
  [UIType.ThreeMeshPhysicalMaterial]: ThreeNode,
  [UIType.ThreeMeshToonMaterial]: ThreeNode,
  [UIType.ThreeMeshDepthMaterial]: ThreeNode,
  [UIType.ThreeRawShaderMaterial]: ThreeNode,
  [UIType.ThreeMeshTransmissionMaterial]: ThreeNode,
  [UIType.ThreeMeshDiscardMaterial]: ThreeNode,
  [UIType.ThreeMeshShaderMaterial]: ThreeNode,
  [UIType.ThreeMeshPortalMaterial]: ThreeNode,
  [UIType.ThreeSimpleGeometry]: ThreeNode,
  [UIType.ThreeShape]: ThreeNode,
  [UIType.ThreeLineShape]: ThreeNode,
  [UIType.ThreeEffectComposer]: ThreeNode,
  [UIType.ThreeEffectOutline]: ThreeNode,
  [UIType.ThreeEffectBloom]: ThreeNode,
  [UIType.ThreeEffectDepthOfField]: ThreeNode,
  [UIType.ThreeEffectToneMapping]: ThreeNode,

  // Viewers
  [UIType.JsonViewer]: JsonViewer,
  [UIType.JsonFastViewer]: JsonFastViewer,
  [UIType.MonacoEditor]: withSuspense(LazyMonacoEditor),
  [UIType.SimpleEditor]: SimpleEditor,
  [UIType.VideoPlayer]: VideoPlayer,
  [UIType.Terminal]: Terminal,
  [UIType.AppTerminal]: AppTerminal,

  // Data model
  [UIType.DataModel]: DataModel,
  [UIType.JsonLikeTreeView]: TanstackJsonLikeTree,
  [UIType.TanstackJsonLikeTreeView]: TanstackJsonLikeTree,
  [UIType.DataGrid]: DataGrid,
  [UIType.DataFlexBox]: DataFlexBox,
  [UIType.MatrixDataGrid]: MatrixDataGrid,

  // Flow
  [UIType.Flow]: Flow,
  [UIType.FlowMiniMap]: FlowMiniMap,
  [UIType.FlowControls]: FlowControls,
  [UIType.FlowBackground]: FlowBackground,
  [UIType.FlowHandle]: FlowHandle,
  [UIType.FlowNodeResizer]: FlowNodeResizer,
  [UIType.FlowNodeToolBar]: FlowNodeToolbar,

  // Leaflet
  [UIType.LeafletMapContainer]: LeafletMapContainer,
  [UIType.LeafletTileLayer]: LeafletTileLayer,
  [UIType.LeafletMarker]: LeafletMarker,

  // UIKit
  [UIType.UIKitRoot]: UIKitRoot,

  // Special
  [UIType.Fragment]: Fragment,
  [UIType.MatchCase]: MatchCase,
};
