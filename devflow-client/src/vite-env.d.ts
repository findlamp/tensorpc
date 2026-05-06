/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_WS_HOST?: string;
  readonly VITE_DEFAULT_WS_PORT?: string;
  readonly VITE_DEFAULT_WS_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
