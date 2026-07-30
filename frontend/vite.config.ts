import path from "path";
import fs from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig(({ command }) => {
    const isDev = command === "serve";

    return {
        base: './',
        define: {
            __APP_VERSION__: JSON.stringify(pkg.version),
        },
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        heroui: ["@heroui/react"],
                        vendor: ["react", "react-dom", "react-router-dom"],
                    },
                },
            },
        },
        server: isDev
            ? {
                  host: "0.0.0.0",
                  // 구글 OAuth 허용 origin 에 등록된 포트입니다 — 바꾸면 로그인이 막힙니다
                  port: 5188,
                  https: {
                      key: fs.readFileSync(
                          path.resolve(__dirname, "localhost+1-key.pem"),
                      ),
                      cert: fs.readFileSync(
                          path.resolve(__dirname, "localhost+1.pem"),
                      ),
                  },
                  proxy: {
                      "/api": {
                          target: "http://127.0.0.1:8000",
                          changeOrigin: true,
                          rewrite: (path) => path.replace(/^\/api/, ""),
                      },
                  },
              }
            : undefined,
    };
});
