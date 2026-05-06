import type { ReactNode } from "react";
import type { SvgIconComponent } from "@mui/icons-material";
import AccountTree from "@mui/icons-material/AccountTree";
import Add from "@mui/icons-material/Add";
import AddCard from "@mui/icons-material/AddCard";
import BarChart from "@mui/icons-material/BarChart";
import BugReport from "@mui/icons-material/BugReport";
import Build from "@mui/icons-material/Build";
import Cached from "@mui/icons-material/Cached";
import CameraAlt from "@mui/icons-material/CameraAlt";
import Cancel from "@mui/icons-material/Cancel";
import Check from "@mui/icons-material/Check";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Clear from "@mui/icons-material/Clear";
import Close from "@mui/icons-material/Close";
import Code from "@mui/icons-material/Code";
import ContentCopy from "@mui/icons-material/ContentCopy";
import ContentCut from "@mui/icons-material/ContentCut";
import ContentPaste from "@mui/icons-material/ContentPaste";
import Dashboard from "@mui/icons-material/Dashboard";
import DataArray from "@mui/icons-material/DataArray";
import DataObject from "@mui/icons-material/DataObject";
import Dataset from "@mui/icons-material/Dataset";
import Delete from "@mui/icons-material/Delete";
import Done from "@mui/icons-material/Done";
import Download from "@mui/icons-material/Download";
import DragHandle from "@mui/icons-material/DragHandle";
import DragIndicator from "@mui/icons-material/DragIndicator";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Fullscreen from "@mui/icons-material/Fullscreen";
import FullscreenExit from "@mui/icons-material/FullscreenExit";
import Grid3x3 from "@mui/icons-material/Grid3x3";
import HelpOutline from "@mui/icons-material/HelpOutline";
import Image from "@mui/icons-material/Image";
import Info from "@mui/icons-material/Info";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import Link from "@mui/icons-material/Link";
import LinkOff from "@mui/icons-material/LinkOff";
import ManageAccounts from "@mui/icons-material/ManageAccounts";
import Menu from "@mui/icons-material/Menu";
import MoreVert from "@mui/icons-material/MoreVert";
import Output from "@mui/icons-material/Output";
import Pause from "@mui/icons-material/Pause";
import PlayArrow from "@mui/icons-material/PlayArrow";
import PlayCircleOutline from "@mui/icons-material/PlayCircleOutline";
import Preview from "@mui/icons-material/Preview";
import Refresh from "@mui/icons-material/Refresh";
import RestartAlt from "@mui/icons-material/RestartAlt";
import Save from "@mui/icons-material/Save";
import Search from "@mui/icons-material/Search";
import Settings from "@mui/icons-material/Settings";
import Stop from "@mui/icons-material/Stop";
import StopCircleOutlined from "@mui/icons-material/StopCircleOutlined";
import SwapVert from "@mui/icons-material/SwapVert";
import TableView from "@mui/icons-material/TableView";
import Terminal from "@mui/icons-material/Terminal";
import Upload from "@mui/icons-material/Upload";
import Videocam from "@mui/icons-material/Videocam";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { getIconName } from "../../render/iconMap";
import { numOrStr } from "../../utils/helpers";

const ICON_COMPONENTS: Record<string, SvgIconComponent> = {
  AccountTree,
  Add,
  AddCard,
  BarChart,
  BugReport,
  Build,
  Cached,
  CameraAlt,
  Cancel,
  Check,
  ChevronLeft,
  ChevronRight,
  Clear,
  Close,
  Code,
  ContentCopy,
  ContentCut,
  ContentPaste,
  Dashboard,
  DataArray,
  DataObject,
  Dataset,
  Delete,
  Done,
  Download,
  DragHandle,
  DragIndicator,
  ExpandLess,
  ExpandMore,
  Fullscreen,
  FullscreenExit,
  Grid3x3,
  Help: HelpOutline,
  HelpOutline,
  Image,
  Info,
  Input: Output,
  KeyboardArrowDown,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  KeyboardArrowUp,
  Link,
  LinkOff,
  ManageAccounts,
  Menu,
  MoreVert,
  Output,
  Pause,
  PlayArrow,
  PlayCircleOutline,
  Preview,
  Refresh,
  RestartAlt,
  Save,
  Search,
  Settings,
  Stop,
  StopCircleOutlined,
  SwapVert,
  TableView,
  Terminal,
  Upload,
  Videocam,
  Visibility,
  VisibilityOff,
};

function resolveMuiIcon(iconName: string): SvgIconComponent | null {
  return ICON_COMPONENTS[iconName] ?? null;
}

export function renderIcon(
  iconVal: unknown,
  props?: {
    fontSize?: string | number;
    color?: string;
    sx?: Record<string, unknown>;
  },
): ReactNode {
  if (iconVal === undefined || iconVal === null) return null;
  const iconName = getIconName(iconVal);
  if (!iconName) return null;
  const SvgIcon = resolveMuiIcon(iconName);
  if (!SvgIcon) return null;
  return (
    <SvgIcon
      sx={{
        fontSize: props?.fontSize ? numOrStr(props.fontSize) : 16,
        color: props?.color,
        lineHeight: 1,
        ...props?.sx,
      }}
    />
  );
}

export function IconComp({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, overflow: "hidden", flexShrink: 0 }}>
      {renderIcon(props.icon, {
        fontSize: numOrStr(props.iconFontSize),
        color: props.color as string | undefined,
      })}
    </span>
  );
}
