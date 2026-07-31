import type { CalendarEvent, EventCategory, TimeMode } from "../types";

/**
 * 달력 화면이 쓰는 날짜·일정 계산.
 *
 * 화면은 그리기만 하고 셈은 전부 여기서 합니다. 특히 **주차**는 학사일정의 뼈대라
 * 매일 보여야 하는데, 이걸 컴포넌트 안에서 계산하면 달을 넘길 때마다 어긋납니다.
 */

/** 로컬 기준 `YYYY-MM-DD`. `toISOString()` 은 UTC 로 밀려서 하루가 어긋납니다 */
export const toKey = (date: Date): string => {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${m}-${d}`;
};

export const fromKey = (key: string): Date => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
};

export const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

/** 달력 격자는 일요일부터 시작합니다 */
const startOfWeek = (date: Date): Date => addDays(date, -date.getDay());

/**
 * 한 달을 그리는 데 필요한 6주(42칸)를 돌려줍니다.
 *
 * 항상 6주를 쓰는 이유는 달마다 5주·6주로 오가면 격자 높이가 널뛰기 때문입니다.
 */
export const monthGrid = (year: number, month: number): Date[] => {
    const first = startOfWeek(new Date(year, month - 1, 1));
    return Array.from({ length: 42 }, (_, i) => addDays(first, i));
};

/** 그 달에 속한 날인지 — 앞뒤 달에서 딸려온 칸은 흐리게 그립니다 */
export const inMonth = (date: Date, year: number, month: number): boolean =>
    date.getFullYear() === year && date.getMonth() + 1 === month;

export const isSameDay = (a: Date, b: Date): boolean => toKey(a) === toKey(b);

/**
 * 날짜별로 일정을 흩뿌립니다. 기간 일정은 걸치는 모든 날에 들어갑니다.
 *
 * 하루에 여러 건이 겹치므로 순서를 정해 둡니다 — 공휴일·시험처럼 **그날의 성격을
 * 정하는 것**이 위로 옵니다. 개인 일정은 맨 아래입니다.
 */
const CATEGORY_ORDER: Record<EventCategory, number> = {
    holiday: 0,
    exam: 1,
    term: 2,
    dorm: 3,
    academic: 4,
    event: 5,
};

export const groupByDate = (
    events: CalendarEvent[],
): Record<string, CalendarEvent[]> => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
        let cursor = fromKey(event.start_date);
        const last = fromKey(event.end_date);
        // 기간이 아주 길어도(연중 행사) 격자 밖까지 돌 필요는 없습니다
        for (let i = 0; cursor <= last && i < 400; i += 1) {
            const key = toKey(cursor);
            (map[key] ||= []).push(event);
            cursor = addDays(cursor, 1);
        }
    });
    Object.values(map).forEach((list) =>
        list.sort((a, b) => {
            if (a.is_personal !== b.is_personal) return a.is_personal ? 1 : -1;
            const byCategory =
                CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
            return byCategory !== 0 ? byCategory : a.title.localeCompare(b.title);
        }),
    );
    return map;
};

/**
 * 학사 주차. `N주차 종료` 표지에서 거꾸로 세웁니다.
 *
 * 학기 시작일을 따로 받지 않는 이유는 문서에 그 값이 없기 때문입니다. 대신 "몇 주차가
 * 언제 끝나는지"는 적혀 있어서, 종료일에서 6일을 빼면 그 주차의 시작이 됩니다.
 */
export interface WeekMarker {
    week: number;
    /** 그 주차가 끝나는 날 */
    end: string;
}

const WEEK_TITLE = /^(\d{1,2})주차\s*종료$/;

export const weekMarkers = (events: CalendarEvent[]): WeekMarker[] =>
    events
        .map((e) => {
            const m = WEEK_TITLE.exec(e.title.trim());
            return m ? { week: Number(m[1]), end: e.end_date } : null;
        })
        .filter((v): v is WeekMarker => v !== null)
        .sort((a, b) => a.end.localeCompare(b.end));

/** 그날이 몇 주차인지. 표지가 없는 기간(방학 등)이면 null */
export const weekOf = (date: Date, markers: WeekMarker[]): number | null => {
    const key = toKey(date);
    for (const marker of markers) {
        if (key <= marker.end) {
            const start = toKey(addDays(fromKey(marker.end), -6));
            return key >= start ? marker.week : null;
        }
    }
    return null;
};

/** 시간 표기. 종일이면 빈 문자열이라 화면에서 그냥 안 그리면 됩니다 */
export const timeLabel = (event: {
    time_mode: TimeMode;
    start_minute: number | null;
    end_minute: number | null;
    start_period: number | null;
    end_period: number | null;
}): string => {
    if (event.time_mode === "clock" && event.start_minute !== null) {
        const fmt = (m: number) =>
            `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        return event.end_minute !== null && event.end_minute !== event.start_minute
            ? `${fmt(event.start_minute)}–${fmt(event.end_minute)}`
            : fmt(event.start_minute);
    }
    if (event.time_mode === "period" && event.start_period !== null) {
        return event.end_period !== null && event.end_period !== event.start_period
            ? `${event.start_period}–${event.end_period}교시`
            : `${event.start_period}교시`;
    }
    return "";
};

/** 대상 학년 표기. 빈 배열은 전학년이라 아무것도 안 씁니다 */
export const gradeLabel = (grades: number[]): string =>
    grades.length === 0 ? "" : `${grades.join("·")}학년`;

export const CATEGORY_LABEL: Record<EventCategory, string> = {
    holiday: "공휴일",
    dorm: "귀가·생활관",
    exam: "시험",
    term: "학기",
    academic: "학사",
    event: "행사",
};

/**
 * 성격별 색. 디자인 가이드의 "한 색은 한 뜻" 규칙을 따릅니다 — 여기서 쓰는 색은
 * 다른 화면에서 다른 뜻으로 쓰이지 않아야 합니다.
 */
export const CATEGORY_STYLE: Record<EventCategory, { dot: string; chip: string }> = {
    holiday: { dot: "bg-retro-primary", chip: "bg-retro-primary/15 text-retro-primary" },
    exam: { dot: "bg-retro-secondary", chip: "bg-retro-secondary/15 text-retro-secondary" },
    term: { dot: "bg-retro-accent4", chip: "bg-retro-accent4/20 text-black" },
    dorm: { dot: "bg-retro-accent5", chip: "bg-retro-accent5/20 text-black" },
    academic: { dot: "bg-black/50", chip: "bg-black/[0.07] text-black/70" },
    event: { dot: "bg-black/25", chip: "bg-black/[0.05] text-black/60" },
};

export const MONTH_LABEL = [
    "1월", "2월", "3월", "4월", "5월", "6월",
    "7월", "8월", "9월", "10월", "11월", "12월",
];

export const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
