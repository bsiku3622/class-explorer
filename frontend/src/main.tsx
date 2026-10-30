import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// ⚠️ index.css 가 먼저입니다 — CSS 레이어 순서는 처음 선언된 순서로 굳고, 그 선언이 index.css 맨 위에 있습니다
import "./index.css";
import "@studio-baeks/funky-ui/styles.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);
