import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const bridgeProxy = {
  "/api": {
    target: "http://127.0.0.1:8765",
    changeOrigin: true,
  },
  "/ws": {
    target: "http://127.0.0.1:8765",
    ws: true,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { ...bridgeProxy },
  },
  preview: {
    proxy: { ...bridgeProxy },
  },
});
