/**
 * 검색창의 최근 검색어 — 이 기기의 `localStorage` 에만 둡니다(`SearchInput`).
 *
 * 학생 이름·학번이 그대로 들어가서 **로그아웃 때 지웁니다**(`App.tsx` 의 `handleLogout`). 학교 공용 PC 에서
 * 다음 사람에게 앞사람이 찾던 이름이 뜨면 안 됩니다. 키를 컴포넌트 밖으로 꺼낸 것도 그래서입니다.
 */

const HISTORY_KEY = "ksa_search_history";
const MAX_HISTORY = 8;

export function loadHistory(): string[] {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
}

export function saveToHistory(term: string) {
    if (!term.trim()) return;
    const prev = loadHistory().filter((h) => h !== term);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([term, ...prev].slice(0, MAX_HISTORY)));
}

export function removeFromHistory(term: string) {
    const next = loadHistory().filter((h) => h !== term);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY); }
    catch { /* 저장소가 막힌 브라우저 — 지울 것도 없습니다 */ }
}
