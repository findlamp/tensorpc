import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendHost = env.VITE_DEFAULT_WS_HOST || "127.0.0.1";
  const backendPort = env.VITE_DEFAULT_WS_PORT || "51052";
  const backendTarget =
    env.VITE_PROXY_HTTP_TARGET || `http://${backendHost}:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/@mui/material") || id.includes("node_modules/@mui/icons-material") || id.includes("node_modules/@mui/base") || id.includes("node_modules/@mui/system") || id.includes("node_modules/@mui/utils") || id.includes("node_modules/@mui/private-theming") || id.includes("node_modules/@mui/styled-engine")) {
              return "mui-core";
            }
            if (id.includes("node_modules/@mui/x-charts")) {
              return "charts-lib";
            }
            if (id.includes("node_modules/protobufjs") || id.includes("node_modules/long")) {
              return "protocol";
            }
            if (id.includes("node_modules/react-markdown") || id.includes("node_modules/mdast") || id.includes("node_modules/unified") || id.includes("node_modules/remark")) {
              return "markdown-lib";
            }
            if (id.includes("node_modules/reactflow") || id.includes("node_modules/@reactflow")) {
              return "reactflow-lib";
            }
            if (id.includes("node_modules/@xterm")) {
              return "xterm-lib";
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
