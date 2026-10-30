/**
 * 일정 성격별 색 — funky-ui 의 accent 로 고릅니다. 한 색은 한 뜻이라, 여기서 쓰는 색을 다른 화면이 다른 뜻으로
 * 쓰지 않습니다. 달력 칩(`CalendarGrid`)과 분류 점(달력 옆 칸 · 홈의 오늘 일정)이 같이 읽습니다.
 */
import type { Accent, SwatchProps } from "@studio-baeks/funky-ui";
import type { EventCategory } from "../types";

export const CATEGORY_ACCENT: Record<EventCategory, Accent> = {
    holiday: "pink",
    exam: "purple",
    term: "orange",
    dorm: "sky",
    academic: "black",
    event: "black",
};

/** 분류 점 — 회색 두 성격은 사다리의 칸으로 가립니다 */
export const CATEGORY_DOT: Record<EventCategory, Pick<SwatchProps, "accent" | "rung">> = {
    holiday: { accent: "pink" },
    exam: { accent: "purple" },
    term: { accent: "orange" },
    dorm: { accent: "sky" },
    academic: { accent: "black", rung: "softInk" },
    event: { accent: "black", rung: "soft" },
};
