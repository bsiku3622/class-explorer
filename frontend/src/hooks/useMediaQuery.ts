/**
 * CSS 미디어 쿼리가 지금 맞는가 — 창 크기가 바뀌거나 기기를 돌리면 다시 그립니다.
 *
 * 화면 폭에 따라 **그리는 컴포넌트 자체가** 달라서 CSS(`md:`)로는 못 가를 때 씁니다.
 * 예: Ask 창은 데스크탑이면 미니 창, 폰이면 전체 화면 창입니다 (`AgentDock`).
 */
import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const list = window.matchMedia(query);
            list.addEventListener("change", onChange);
            return () => list.removeEventListener("change", onChange);
        },
        [query],
    );
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
