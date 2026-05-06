# devflow-client

TypeScript/React frontend for tensorpc's WebSocket-based UI protocol. Connects to a tensorpc backend, subscribes to `Flow.app_event`, and renders UI layouts from `UpdateLayout` events.

## Architecture

```
src/
├── main.tsx                         # Entry point
├── App.tsx                          # Top-level: ThemeProvider + Context providers
├── AppShell.tsx                     # Connection UI + layout rendering
├── index.css                        # Global styles
├── css.d.ts                         # CSS module type declaration
├── core/                            # Wire protocol (binary WebSocket + JSON/ndarray codec)
│   ├── wsHeader.ts                  # Protobuf header encode/decode
│   ├── socketTypes.ts               # SocketMsgType, AppEventType enums
│   ├── jsonCodec.ts                 # JSON skeleton + ndarray binary codec
│   └── tensorPcWs.ts               # WebSocket client (connect, subscribe, event dispatch)
├── context/                         # React context providers
│   ├── TensorPcContext.tsx          # WS connection, status, URL
│   ├── LayoutContext.tsx            # Current layout model from UpdateLayout
│   └── ErrorBoundary.tsx            # Per-component render error isolation
├── components/                      # UI components (one per UIType)
│   ├── types.ts                     # Typed prop interfaces for all UITypes
│   ├── registry.ts                  # UIType → Component mapping
│   ├── ComponentNode.tsx            # Thin router: lookup type → render component
│   ├── LayoutRoot.tsx               # Root component: find root node, extract layout
│   ├── layout/                      # Container components
│   │   ├── FlexBox.tsx
│   │   ├── Paper.tsx
│   │   ├── Card.tsx
│   │   ├── Collapse.tsx
│   │   ├── Dialog.tsx
│   │   ├── TooltipFlexBox.tsx
│   │   ├── ThemeProvider.tsx
│   │   ├── Accordion.tsx
│   │   ├── AccordionSummary.tsx
│   │   └── AccordionDetail.tsx
│   ├── buttons/                     # Button variants
│   │   ├── Button.tsx
│   │   ├── ButtonGroup.tsx
│   │   ├── ToggleButton.tsx
│   │   ├── ToggleButtonGroup.tsx
│   │   └── IconButton.tsx
│   ├── inputs/                      # Form controls
│   │   ├── TextField.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── MultipleSelect.tsx
│   │   ├── Switch.tsx
│   │   ├── Checkbox.tsx
│   │   ├── RadioGroup.tsx
│   │   ├── Slider.tsx
│   │   └── Chip.tsx
│   ├── display/                     # Display components
│   │   ├── Typography.tsx
│   │   ├── Icon.tsx
│   │   ├── Divider.tsx
│   │   ├── Link.tsx
│   │   ├── Image.tsx
│   │   ├── Alert.tsx
│   │   ├── CircularProgress.tsx
│   │   ├── LinearProgress.tsx
│   │   ├── IFrame.tsx
│   │   └── Pagination.tsx
│   ├── list/                        # List components
│   │   ├── MUIList.tsx
│   │   ├── ListItemButton.tsx
│   │   ├── ListItemText.tsx
│   │   ├── ListItemIcon.tsx
│   │   ├── MenuList.tsx
│   │   ├── Tabs.tsx
│   │   └── Breadcrumbs.tsx
│   ├── charts/                      # Chart components (stubs)
│   │   ├── BarChart.tsx
│   │   ├── LineChart.tsx
│   │   └── ScatterChart.tsx
│   └── three/                       # Three.js stubs
│       └── ThreeCanvas.tsx
├── hooks/                           # Shared React hooks
│   ├── useFlexStyles.ts             # FlexComponentBaseProps → CSSProperties
│   ├── useChildNodes.ts             # Resolve child component references
│   ├── useLayoutModel.ts            # LayoutModel/ComponentProps types
│   └── useSendEvent.ts              # Send UI events back to backend
├── render/                          # Pure data (kept from original)
│   ├── uiTypes.ts                   # UIType enum values
│   └── iconMap.ts                   # IconType → MUI icon name mapping
└── utils/
    └── helpers.ts                   # numOrStr, flexStyles, childUids
```

## Key Design Decisions

- **Component Registry**: UIType numbers map to React components via `COMPONENT_REGISTRY`. Unknown types render a debug fallback box.
- **Error Boundaries**: Each `ComponentNode` is wrapped in `ErrorBoundary` so one broken component doesn't crash the entire tree.
- **Typed Props**: Individual components use typed props interfaces from `components/types.ts` rather than `Record<string, unknown>`.
- **Context Separation**: `TensorPcContext` (WebSocket connection) and `LayoutContext` (UI state) are independent providers.
- **Pre-rendered Children**: Parent `ComponentNode` resolves child nodes recursively before passing them to the leaf component, avoiding circular dependencies.

## What works

- Binary WebSocket protocol with protobuf headers + JSON skeleton + ndarray codec
- `QueryServiceIds` + `Subscribe` on `Flow.app_event`
- `UpdateLayout` rendering for 40+ UITypes (MUI controls, containers, display)
- Error isolation per component

## What's next

- Interactive UI events (wire up `useSendEvent` with HTTP RPC to backend)
- Chunked events / large message support
- MUI X Charts integration (replace stubs with real `@mui/x-charts`)
- Three.js components (react-three-fiber)
- Monaco Editor, Video streams, Flow graph shell
- Code splitting for large dependencies

## Run

```bash
cd devflow-client
npm install
npm run dev
```

Point WebSocket at your tensorpc server, e.g. `ws://127.0.0.1:51052/api/ws/<clientId>`.
