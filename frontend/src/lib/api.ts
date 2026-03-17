import axios from "axios";

// 개발: VITE_API_BASE_URL 미설정 → "/api" (Vite 프록시 → localhost:8000)
// 배포: VITE_API_BASE_URL=https://classes_api.bsiku.dev → 직접 호출
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

export default api;
