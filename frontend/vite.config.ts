import path from "path";
import fs from "fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig(({ command }) => {
    const isDev = command === "serve";

    return {
        // ⚠️ **`'./'` 로 두지 마세요.** 상대 경로가 되면 `index.html` 이
        // `./assets/…` 를 가리키는데, SPA 라 어느 주소로 들어와도 같은 파일을
        // 받습니다 — 그래서 **주소 깊이만큼 에셋 경로가 밀립니다.**
        //
        //   /              → /assets/…        ✅
        //   /search        → /assets/…        ✅ (한 단계는 우연히 맞습니다)
        //   /auth/google   → /auth/assets/…   ❌ HTML 이 돌아오고 스크립트가 안 뜹니다
        //
        // 두 단계 주소가 `/auth/google` 하나뿐이라 그때까지 안 터졌고, 증상은 **흰
        // 화면**입니다(콘솔에 MIME 오류). 루트에 배포하므로 절대 경로가 맞습니다.
        base: '/',
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
