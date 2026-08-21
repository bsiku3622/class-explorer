import { useCallback, useEffect, useState } from "react";

interface Options {
    /** 첫 측정 전에 그릴 개수. 이만큼은 그려야 한 줄의 높이를 잴 수 있습니다 */
    initialCount?: number;
    /** 화면 위아래로 더 그려 둘 줄 수 */
    overscan?: number;
}

interface Anchors {
    /** 바깥 컨테이너 — **문서상 위치가 고정된 자리**라 스크롤 기준으로 씁니다 */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** 그리드 자체 — 열 수와 줄 높이를 여기서 잽니다 */
    gridRef: React.RefObject<HTMLDivElement | null>;
}

interface Result<T> {
    visible: T[];
    topSpacer: number;
    bottomSpacer: number;
}

/**
 * 창 스크롤을 기준으로 보이는 줄만 그립니다.
 *
 * `/browse` 는 전교생을 한 번에 그려서 DOM 이 7,397 노드였습니다. 다른 페이지가
 * 286~1,438 인 걸 감안하면 이 페이지만 5~25배입니다.
 *
 * 스크롤 컨테이너가 따로 없고 **문서 전체가 스크롤**되는 구조라, 컨테이너의 문서상
 * 위치와 `window.scrollY` 를 견줘 몇 번째 줄이 보이는지 계산합니다. 그리드가 아니라
 * 바깥 컨테이너를 기준 삼는 이유는, 위쪽 여백이 늘었다 줄었다 하면서 **그리드 자신의
 * 위치는 계속 움직이기** 때문입니다.
 *
 * 줄 높이는 하나로 봅니다. 카드가 몇 px 더 클 수 있지만 넘치는 만큼은 줄 간격을 파고들
 * 뿐이라 눈에 띄지 않습니다. **높이가 크게 들쭉날쭉한 목록에는 쓰지 마세요** — 그런 건
 * 스크롤 막대가 튑니다.
 *
 * ⚠️ **ref 는 부르는 쪽이 만들어 넘깁니다.** 훅이 돌려주면 React 컴파일러가 반환값 전체를
 * ref 로 보고 `visible` 을 읽는 것까지 "렌더 중 ref 접근" 으로 막습니다.
 */
export function useVirtualGrid<T>(
    items: T[],
    { containerRef, gridRef }: Anchors,
    options: Options = {},
): Result<T> {
    const { initialCount = 24, overscan = 3 } = options;
    // 측정값을 ref 가 아니라 state 로 둡니다 — 여백 높이를 렌더에서 써야 하는데,
    // 렌더 중 ref 를 읽으면 값이 바뀌어도 다시 그리지 않습니다
    const [metrics, setMetrics] = useState({ cols: 1, rowHeight: 0 });
    const [range, setRange] = useState({ start: 0, end: initialCount });

    const measure = useCallback(() => {
        const container = containerRef.current;
        const grid = gridRef.current;
        const first = grid?.firstElementChild as HTMLElement | null;
        if (!container || !grid || !first || items.length === 0) return;

        const style = getComputedStyle(grid);
        const cols = style.gridTemplateColumns.split(" ").filter(Boolean).length || 1;
        const rowHeight = first.getBoundingClientRect().height + (parseFloat(style.rowGap) || 0);
        if (!rowHeight) return;
        setMetrics((prev) =>
            prev.cols === cols && prev.rowHeight === rowHeight ? prev : { cols, rowHeight },
        );

        const top = container.getBoundingClientRect().top + window.scrollY;
        const rows = Math.ceil(items.length / cols);
        const from = Math.floor((window.scrollY - top) / rowHeight) - overscan;
        const to = Math.ceil((window.scrollY + window.innerHeight - top) / rowHeight) + overscan;

        const startRow = Math.max(0, Math.min(from, rows));
        const endRow = Math.max(startRow + 1, Math.min(to, rows));
        const next = { start: startRow * cols, end: Math.min(endRow * cols, items.length) };
        setRange((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    }, [items.length, overscan, containerRef, gridRef]);

    useEffect(() => {
        // 첫 측정은 그려진 다음이라야 합니다. effect 안에서 바로 setState 하지 않으려고
        // 한 프레임 미룹니다
        const id = requestAnimationFrame(measure);
        window.addEventListener("scroll", measure, { passive: true });
        window.addEventListener("resize", measure);
        return () => {
            cancelAnimationFrame(id);
            window.removeEventListener("scroll", measure);
            window.removeEventListener("resize", measure);
        };
    }, [measure]);

    const { cols, rowHeight } = metrics;
    const rows = Math.ceil(items.length / cols);
    // 목록이 갈려 범위가 넘칠 수 있습니다. 다음 프레임에 `measure` 가 바로잡지만
    // 그 전에도 엉뚱한 자리를 그리지 않게 여기서 자릅니다
    const start = Math.min(range.start, Math.max(0, (rows - 1) * cols));
    const end = Math.min(range.end, items.length);
    const startRow = Math.floor(start / cols);
    const endRow = Math.ceil(Math.max(end, start + 1) / cols);

    return {
        visible: items.slice(start, end),
        topSpacer: rowHeight ? startRow * rowHeight : 0,
        bottomSpacer: rowHeight ? Math.max(0, (rows - endRow) * rowHeight) : 0,
    };
}
