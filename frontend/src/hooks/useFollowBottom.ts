/**
 * 대화가 늘면 맨 아래로 따라갑니다 — **위로 올려 읽는 중이면 끌어내리지 않습니다.**
 *
 * `/ai` 는 창 전체가, 미니 창·모바일 창은 그 안의 상자가 스크롤됩니다. `box` 를 주면 그 상자를,
 * 안 주면 창을 잽니다.
 *
 * ⚠️ "바닥에 있었는가" 는 **스크롤할 때** 잽니다. 그리면서 재면 안 됩니다 — 답이 붙은 뒤에 재면
 * 답 높이만큼 멀어져 있어서 "읽는 중" 으로 오해하고 안 따라갑니다(마지막 줄이 입력창에 가렸습니다)
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { Turn } from "../lib/agentChat";

/** 바닥에서 이만큼 안쪽이면 바닥으로 칩니다 */
const SLACK = 160;

export function useFollowBottom(turns: Turn[], box?: RefObject<HTMLElement | null>): void {
    const count = useRef(turns.length);
    const atBottom = useRef(true);

    useEffect(() => {
        const el = box?.current ?? null;
        const onScroll = () => {
            atBottom.current = el
                ? el.scrollTop + el.clientHeight >= el.scrollHeight - SLACK
                : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - SLACK;
        };
        const target = el ?? window;
        target.addEventListener("scroll", onScroll, { passive: true });
        return () => target.removeEventListener("scroll", onScroll);
    }, [box]);

    useLayoutEffect(() => {
        const added = turns.length !== count.current;
        count.current = turns.length;
        if (!added && !atBottom.current) return;
        // 입력창이 흐름의 맨 끝(또는 상자 밖 바닥)에 있으니 끝까지 내리면 대화 끝이 입력창 바로 위에 옵니다
        const el = box?.current;
        if (el) el.scrollTo({ top: el.scrollHeight });
        else window.scrollTo({ top: document.documentElement.scrollHeight });
    }, [turns, box]);
}
