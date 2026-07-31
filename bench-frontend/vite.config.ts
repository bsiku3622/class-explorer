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
                  // class-explorer(5188)와 나란히 띄우려고 포트를 옮겼습니다.
                  // 구글 확인을 로컬에서 쓰려면 이 주소도 OAuth 허용 origin 에 등록해야 합니다
                  port: 5189,
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
                          // ksa-bench 는 **8001**(`backend.bench_main:app`)을 봅니다.
                          // 8000 은 class-explorer 라 명단이 나오는 쪽입니다 — 여기로
                          // 붙이면 이 앱의 전제가 로컬에서만 조용히 깨집니다
                          target: "http://127.0.0.1:8001",
                          changeOrigin: true,
                          rewrite: (path) => path.replace(/^\/api/, ""),
                      },
                  },
              }
            : undefined,
    };
});
