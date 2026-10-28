/**
 * 모바일 Ask 창 → `/ai` 로 넘어가는 모션.
 *
 * 브라우저의 View Transitions 를 씁니다 — 옛 화면(창)과 새 화면(페이지)을 한 장씩 찍어 그 사이를 잇습니다.
 * 같은 이름(`ASK_COMPOSER`)을 단 입력창은 **창 가운데에서 페이지 바닥으로 내려앉고**, 나머지는 겹쳐
 * 바랩니다(`index.css`). 지원하지 않는 브라우저와 "동작 줄이기" 설정에서는 그냥 옮깁니다.
 *
 * ⚠️ **새 화면은 `/ai` 가 그려졌다고 알려 올 때 찍습니다** (`askPageReady`). 주소를 바꾼 직후에 찍으면
 * 안 됩니다 — `BrowserRouter` 가 주소 변경을 `startTransition` 으로 넘겨서 `flushSync` 로도 당장 안
 * 그려지고, 페이지가 lazy 라 청크를 기다리기도 합니다. 그동안 화면은 옛 모습에 멈춰 있으므로 오래
 * 기다리지 않습니다 (`WAIT_MS`).
 */
export const ASK_COMPOSER = "ask-composer";

const WAIT_MS = 1500;

let arrived: (() => void) | null = null;

/** `/ai` 가 화면에 붙었다 — 기다리던 모션이 있으면 새 화면을 찍게 합니다 */
export const askPageReady = (): void => {
    arrived?.();
    arrived = null;
};

/** `update` 안에서 `/ai` 로 옮기면 그 사이를 모션으로 잇습니다 */
export function moveToAskPage(update: () => void): void {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition !== "function" || reduce) {
        update();
        return;
    }
    document.startViewTransition(
        () =>
            new Promise<void>((resolve) => {
                arrived = resolve;
                update();
                window.setTimeout(resolve, WAIT_MS);
            }),
    );
}
