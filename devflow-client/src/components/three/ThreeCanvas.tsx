import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import type { ComponentProps } from "../../hooks/useLayoutModel";
import { UIType } from "../../render/uiTypes";
import { childUids } from "../../utils/helpers";
import { lookupLayoutNode, normalizeLayoutUid } from "../../utils/layoutRefs";

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: [number, number, number, number];
};

type GlState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  position: number;
  color: number;
  buffer: WebGLBuffer;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function decodeUniqueTreeIdParts(value: string): string[] | null {
  const splitIndex = value.indexOf("|");
  if (splitIndex < 0) return null;
  const lengths = value
    .slice(0, splitIndex)
    .split(".")
    .map((part) => Number(part));
  if (lengths.some((part) => !Number.isFinite(part) || part < 0)) return null;
  const payload = value.slice(splitIndex + 1);
  const splitterLength =
    payload.length - lengths.reduce((sum, length) => sum + length, 0);
  const gap = lengths.length > 1 ? splitterLength / (lengths.length - 1) : 0;
  if (!Number.isInteger(gap) || gap < 0) return null;
  const parts: string[] = [];
  let cursor = 0;
  for (const length of lengths) {
    parts.push(payload.slice(cursor, cursor + length));
    cursor += length + gap;
  }
  return parts;
}

function bindingExpression(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parts = decodeUniqueTreeIdParts(value);
  return parts?.[0] ?? value;
}

function getPath(root: unknown, path: string): unknown {
  const clean = path.trim();
  if (!clean) return undefined;
  if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(clean)) {
    return undefined;
  }
  let current: unknown = root;
  for (const part of clean.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function evaluateBinding(model: unknown, encoded: unknown): unknown {
  const expr = bindingExpression(encoded);
  if (!expr) return undefined;
  return getPath(model, expr);
}

function buildParentMap(layout: Record<string, ComponentProps>) {
  const parents = new Map<string, string>();
  for (const [uid, node] of Object.entries(layout)) {
    for (const childUid of childUids(node.props ?? {})) {
      parents.set(normalizeLayoutUid(childUid), normalizeLayoutUid(uid));
    }
  }
  return parents;
}

function nearestDataModel(
  uid: string,
  layout: Record<string, ComponentProps>,
  parents: Map<string, string>,
) {
  let cursor: string | undefined = uid;
  while (cursor) {
    const node = lookupLayoutNode(layout, cursor);
    if (node?.type === UIType.DataModel) return node;
    cursor = parents.get(normalizeLayoutUid(cursor));
  }
  return undefined;
}

function dataModelByUid(
  uid: unknown,
  fallbackUid: string,
  layout: Record<string, ComponentProps>,
  parents: Map<string, string>,
) {
  if (typeof uid === "string" && uid) {
    const direct = lookupLayoutNode(layout, uid);
    if (direct) return direct;
  }
  return nearestDataModel(fallbackUid, layout, parents);
}

function resolvePropsFromDataModel(
  uid: string,
  node: ComponentProps,
  layout: Record<string, ComponentProps>,
  parents: Map<string, string>,
) {
  const out = { ...(node.props ?? {}) };
  const nodeMeta = node as ComponentProps & {
    dmProps?: unknown;
    dmPropsGrouped?: unknown;
  };
  const groups = nodeMeta.dmPropsGrouped;
  if (Array.isArray(groups)) {
    for (const group of groups) {
      if (!Array.isArray(group) || group.length < 2) continue;
      const dm = dataModelByUid(group[0], uid, layout, parents);
      const model = dm?.props?.dataObject;
      const paths = group[1];
      if (!Array.isArray(paths)) continue;
      for (const pair of paths) {
        if (!Array.isArray(pair) || pair.length < 2 || typeof pair[0] !== "string") {
          continue;
        }
        const value = evaluateBinding(model, pair[1]);
        if (value !== undefined) out[pair[0]] = value;
      }
    }
  }

  if (isRecord(nodeMeta.dmProps)) {
    const dm = nearestDataModel(uid, layout, parents);
    const model = dm?.props?.dataObject;
    for (const [key, encodedPath] of Object.entries(nodeMeta.dmProps)) {
      const value = evaluateBinding(model, encodedPath);
      if (value !== undefined) out[key] = value;
    }
  }
  return out;
}

function flattenNumbers(value: unknown): number[] {
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) return [];
    return Array.from(value as unknown as ArrayLike<number>, Number);
  }
  if (Array.isArray(value)) {
    const out: number[] = [];
    for (const item of value) {
      if (Array.isArray(item) || ArrayBuffer.isView(item)) {
        out.push(...flattenNumbers(item));
      } else if (typeof item === "number" && Number.isFinite(item)) {
        out.push(item);
      }
    }
    return out;
  }
  return [];
}

function colorAt(colors: number[], index: number): [number, number, number, number] {
  const base = index * 3;
  if (base + 2 < colors.length) {
    const r = colors[base]!;
    const g = colors[base + 1]!;
    const b = colors[base + 2]!;
    const scale = Math.max(r, g, b) > 1 ? 255 : 1;
    return [r / scale, g / scale, b / scale, 0.92];
  }
  const hue = (index * 47) % 360;
  const c = 0.72;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = 0.22;
  const rgb =
    hue < 60 ? [c, x, 0] :
    hue < 120 ? [x, c, 0] :
    hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] :
    hue < 300 ? [x, 0, c] :
    [c, 0, x];
  return [rgb[0]! + m, rgb[1]! + m, rgb[2]! + m, 0.9];
}

function collectRects(
  uid: string,
  layout: Record<string, ComponentProps>,
  parents: Map<string, string>,
  seen = new Set<string>(),
): Rect[] {
  const normalizedUid = normalizeLayoutUid(uid);
  if (seen.has(normalizedUid)) return [];
  seen.add(normalizedUid);
  const node = lookupLayoutNode(layout, normalizedUid);
  if (!node) return [];
  const props = resolvePropsFromDataModel(normalizedUid, node, layout, parents);
  const rects: Rect[] = [];

  if (node.type === UIType.ThreeBoxes2D) {
    const centers = flattenNumbers(props.centers);
    const dims = flattenNumbers(props.dimensions);
    const colors = flattenNumbers(props.colors);
    const count = Math.floor(centers.length / 2);
    for (let i = 0; i < count; i++) {
      const x = centers[i * 2]!;
      const y = centers[i * 2 + 1]!;
      const w = Math.max(Math.abs(dims[i * 2] ?? dims[0] ?? 0.01), 0.0001);
      const h = Math.max(Math.abs(dims[i * 2 + 1] ?? dims[1] ?? dims[0] ?? 0.2), 0.0001);
      rects.push({ x, y, w, h, color: colorAt(colors, i) });
    }
  } else if (node.type === UIType.ThreeInstancedMesh) {
    const transforms = flattenNumbers(props.transforms);
    const scales = flattenNumbers(props.scales);
    const colors = flattenNumbers(props.colors);
    const countFromScales = Math.floor(scales.length / 3);
    const stride =
      countFromScales > 0 && transforms.length >= countFromScales * 3
        ? Math.floor(transforms.length / countFromScales)
        : transforms.length % 16 === 0
          ? 16
          : transforms.length % 7 === 0
            ? 7
            : 3;
    const count =
      countFromScales > 0
        ? Math.min(countFromScales, Math.floor(transforms.length / stride))
        : Math.floor(transforms.length / stride);
    for (let i = 0; i < count; i++) {
      const tBase = i * stride;
      const sBase = i * 3;
      const x = stride === 16 ? transforms[tBase + 12]! : transforms[tBase]!;
      const y = stride === 16 ? transforms[tBase + 13]! : transforms[tBase + 1]!;
      const w = Math.max(Math.abs(scales[sBase] ?? 0.01), 0.0001);
      const h = Math.max(Math.abs(scales[sBase + 1] ?? scales[sBase] ?? 0.2), 0.0001);
      rects.push({ x, y, w, h, color: colorAt(colors, i) });
    }
  }

  for (const childUid of childUids(props)) {
    rects.push(...collectRects(childUid, layout, parents, seen));
  }
  return rects;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("ThreeCanvas shader compile failed", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initGl(canvas: HTMLCanvasElement): GlState | null {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
  if (!gl) return null;
  const vertex = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec2 a_position;
      attribute vec4 a_color;
      varying vec4 v_color;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_color = a_color;
      }
    `,
  );
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        gl_FragColor = v_color;
      }
    `,
  );
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!program || !buffer) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("ThreeCanvas program link failed", gl.getProgramInfoLog(program));
    return null;
  }
  return {
    gl,
    program,
    position: gl.getAttribLocation(program, "a_position"),
    color: gl.getAttribLocation(program, "a_color"),
    buffer,
  };
}

function draw(glState: GlState, rects: Rect[]) {
  const { gl, program, position, color, buffer } = glState;
  const canvas = gl.canvas as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.02, 0.03, 0.045, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (!rects.length) return;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x - rect.w / 2);
    maxX = Math.max(maxX, rect.x + rect.w / 2);
    minY = Math.min(minY, rect.y - rect.h / 2);
    maxY = Math.max(maxY, rect.y + rect.h / 2);
  }
  const padX = Math.max((maxX - minX) * 0.02, 0.01);
  const padY = Math.max((maxY - minY) * 0.08, 0.01);
  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;
  const rangeX = Math.max(maxX - minX, 0.0001);
  const rangeY = Math.max(maxY - minY, 0.0001);
  const toX = (x: number) => ((x - minX) / rangeX) * 2 - 1;
  const toY = (y: number) => 1 - ((y - minY) / rangeY) * 2;

  const data = new Float32Array(rects.length * 6 * 6);
  let offset = 0;
  for (const rect of rects) {
    const left = toX(rect.x - rect.w / 2);
    const right = toX(rect.x + rect.w / 2);
    const top = toY(rect.y + rect.h / 2);
    const bottom = toY(rect.y - rect.h / 2);
    const [r, g, b, a] = rect.color;
    const verts = [
      left, top,
      right, top,
      left, bottom,
      left, bottom,
      right, top,
      right, bottom,
    ];
    for (let i = 0; i < verts.length; i += 2) {
      data[offset++] = verts[i]!;
      data[offset++] = verts[i + 1]!;
      data[offset++] = r;
      data[offset++] = g;
      data[offset++] = b;
      data[offset++] = a;
    }
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(color);
  gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 24, 8);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, rects.length * 6);
}

export function ThreeCanvas({
  props,
  layout,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
}) {
  const sx = useFlexStyles(props);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<GlState | null>(null);
  const roots = useMemo(() => childUids(props), [props]);
  const parents = useMemo(() => buildParentMap(layout), [layout]);
  const rects = useMemo(
    () => roots.flatMap((uid) => collectRects(uid, layout, parents)),
    [layout, parents, roots],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!glRef.current) glRef.current = initGl(canvas);
    const render = () => {
      if (glRef.current) draw(glRef.current, rects);
    };
    render();
    const resizeObserver = new ResizeObserver(() => {
      render();
    });
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [rects]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !glRef.current) return;
    draw(glRef.current, rects);
  }, [rects]);

  return (
    <div
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height: sx.height ?? "100%",
        flex: sx.flex ?? 1,
        minWidth: sx.minWidth ?? 0,
        minHeight: sx.minHeight ?? 0,
        overflow: "hidden",
        position: "relative",
        background: props.threeBackgroundColor as string | undefined,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          outline: "none",
        }}
      />
    </div>
  );
}
