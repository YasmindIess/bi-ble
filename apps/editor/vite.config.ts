import {
  defineConfig
} from "vite";

import react from
  "@vitejs/plugin-react";

const adapterPort =
  process.env
    .BI_BLE_GITHUB_ADAPTER_PORT ??
  "8787";

const adapterTarget =
  `http://127.0.0.1:${adapterPort}`;

export default defineConfig({
  plugins: [
    react()
  ],

  server: {
    host: "0.0.0.0",

    proxy: {
      "/api/github": {
        target: adapterTarget,
        changeOrigin: false
      }
    }
  },

  preview: {
    host: "0.0.0.0",

    proxy: {
      "/api/github": {
        target: adapterTarget,
        changeOrigin: false
      }
    }
  }
});
