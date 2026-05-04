import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// В dev VITE_API_URL не задан → axios baseURL пустой → запросы
// идут относительно ngrok-URL → перехватываются этим proxy и
// форвардятся в corpmeet.uz. Origin удаляется перед форвардом,
// чтобы CORS не отвергал запрос.
//
// В prod-сборке Docker передаёт VITE_API_URL через --build-arg →
// vite забивает его в бандл → axios идёт напрямую в corpmeet.uz
// без прокси (а CORS на проде уже разрешает свой же origin).

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@tanstack/react-query",
      "framer-motion",
      "axios",
    ],
  },
  server: {
    host: true,
    port: 5174,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "https://corpmeet.uz",
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("origin");
            proxyReq.removeHeader("referer");
          });
        },
      },
    },
  },
});
