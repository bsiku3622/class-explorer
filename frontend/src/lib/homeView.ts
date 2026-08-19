/**
 * 홈이 응답에서 뽑아 쓰는 파생값 — **레이아웃 두 판본이 같이 씁니다.**
 *
 * V1(자 + 목록)과 V2(현재 상태 + 스크롤 목록)가 "지금 몇 교시인가" 를 각자 계산하면
 * 비교하다 어긋난 걸 레이아웃 탓으로 오해하게 됩니다 — 한 곳에서만 셉니다.
 *
 * **모든 값이 `liveMinute` 하나에서 나옵니다.** 서버가 준 `now.minute` 에 그 뒤로
 * 흐른 시간을 더한 값이고, 따로 계산하면 1분 사이에 머리의 시계와 목록의 "지금" 이
 * 어긋납니다.
 */

import type { HomeData, TodayClass } from "./friendsApi";
import { DAYS_ORDER } from "./utils";

export interface HomeView {
    /** 오늘 수업이 있는 날인가 (방학·주말·휴업이 아닌가) */
    isSchoolDay: boolean;
    /** 지금 몇 교시. 쉬는시간이면 null */
    livePeriod: number | null;
    /** 지금 있어야 할 수업. null 이면 공강 */
    current: TodayClass | null;
    /**
     * 지금 수업이 걸친 교시들 — **연강이면 둘 이상**입니다.
     *
     * 10·11교시가 같은 생활음악이면 히어로는 그 둘을 **한 수업**으로 다뤄야 합니다.
     * 안 그러면 20:20 에 끝난다고 말하면서 바로 아래 NEXT 에 같은 과목을 또 겁니다.
     */
    currentPeriods: number[];
    /** 다음 수업. 없으면 오늘 수업이 끝났습니다 */
    next: TodayClass | null;
    /** `"6교시 · 자습"` 처럼. 수업 없는 날엔 null */
    periodLabel: string | null;
    /** 오늘 비는 시간(분). **연강 사이 10분은 세지 않습니다** — 그건 쉬는시간입니다 */
    freeMinutes: number;
}

export const deriveHomeView = (home: HomeData, liveMinute: number): HomeView => {
    const periods = home.periods ?? [];
    const byPeriod = new Map(periods.map((p) => [p.period, p]));
    const isSchoolDay = home.session.has_class;

    const livePeriod = isSchoolDay
        ? (periods.find(
              (p) => liveMinute >= p.start_minute && liveMinute < p.end_minute,
          )?.period ?? null)
        : null;

    const current =
        livePeriod !== null
            ? (home.today.find((c) => c.period === livePeriod) ?? null)
            : null;

    /**
     * 지금 수업을 **연강 단위로 펼칩니다.** 앞뒤로 같은 과목·분반·교실이 붙어 있고
     * 시간이 이어지면 한 덩어리입니다 — 목록·주간 격자가 쓰는 조건과 같습니다.
     *
     * ⚠️ 시간을 같이 보는 건 4교시와 5교시가 번호는 이어져도 사이에 점심이 70분
     * 있어서입니다. 번호만 보면 점심을 가로지르는 연강이 생깁니다.
     */
    const joined = (a: TodayClass, b: TodayClass, gapFrom: number, gapTo: number) =>
        a.subject === b.subject &&
        a.section === b.section &&
        a.room === b.room &&
        gapTo - gapFrom <= 20;

    const currentPeriods: number[] = [];
    if (current) {
        currentPeriods.push(current.period);
        for (let p = current.period - 1; ; p -= 1) {
            const before = home.today.find((c) => c.period === p);
            const beforeTime = byPeriod.get(p);
            const hereTime = byPeriod.get(p + 1);
            if (!before || !beforeTime || !hereTime) break;
            if (!joined(current, before, beforeTime.end_minute, hereTime.start_minute))
                break;
            currentPeriods.unshift(p);
        }
        for (let p = current.period + 1; ; p += 1) {
            const after = home.today.find((c) => c.period === p);
            const beforeTime = byPeriod.get(p - 1);
            const hereTime = byPeriod.get(p);
            if (!after || !beforeTime || !hereTime) break;
            if (!joined(current, after, beforeTime.end_minute, hereTime.start_minute))
                break;
            currentPeriods.push(p);
        }
    }

    /** 지금 덩어리에 속한 교시는 "다음" 이 아닙니다 */
    const next =
        home.today.find(
            (c) =>
                !currentPeriods.includes(c.period) &&
                (byPeriod.get(c.period)?.start_minute ?? 0) > liveMinute,
        ) ?? null;

    // 연강이면 `10–11교시` — 히어로가 말하는 시간 범위와 칩이 어긋나면 안 됩니다
    const periodText =
        currentPeriods.length > 1
            ? `${currentPeriods[0]}–${currentPeriods[currentPeriods.length - 1]}교시`
            : livePeriod
              ? `${livePeriod}교시`
              : "쉬는시간";

    const periodLabel = !isSchoolDay
        ? null
        : [periodText, home.now.break_name].filter(Boolean).join(" · ");

    const freeMinutes = home.today.reduce((sum, item, index) => {
        if (index === 0) return sum;
        const before = home.today[index - 1];
        if (item.period - before.period <= 1) return sum;
        const prev = byPeriod.get(before.period);
        const here = byPeriod.get(item.period);
        return prev && here ? sum + (here.start_minute - prev.end_minute) : sum;
    }, 0);

    return {
        isSchoolDay,
        livePeriod,
        current,
        currentPeriods,
        next,
        periodLabel,
        freeMinutes,
    };
};

/** `250` → `"4시간 10분"` */
export const duration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}분`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
};

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** `"2026-08-03"` → `"2026년 8월 3일 월요일"` */
export const dateLabel = (iso: string): string => {
    const [year, month, day] = iso.split("-").map(Number);
    const weekday = WEEKDAY_KO[new Date(year, month - 1, day).getDay()];
    return `${year}년 ${month}월 ${day}일 ${weekday}요일`;
};

// ─── 이 학기에 내가 듣는 것 ──────────────────────────────────────────────────

/** 한 과목이 한 주에 어떻게 놓여 있는가 */
export interface SubjectSummary {
    subject: string;
    section: string;
    teacher: string;
    /** 교시마다 교실이 다를 수 있어 목록입니다 (대개 하나) */
    rooms: string[];
    department: string | null;
    /** 요일별 교시 — 요일 순서는 `DAYS_ORDER` 를 따릅니다 */
    times: { day: string; periods: number[] }[];
    /** 주 몇 교시인가 */
    periodCount: number;
}

/**
 * 주간 시간표(`week`)를 **과목 단위로 접습니다.**
 *
 * 격자는 "언제" 를 묻는 물건이라 같은 과목이 요일마다 흩어져 있습니다. 여기서는
 * "무엇을 듣고 있나" 를 한 줄씩 셉니다 — 학점을 세거나 분반을 확인할 때 격자를 훑는
 * 대신 목록을 보면 됩니다.
 *
 * ⚠️ **`week` 를 그대로 받습니다.** 계획을 보는 중이면 계획의 과목이 나옵니다
 * (`plannedHome.ts` 가 이미 갈아 끼운 값이라 여기서 따로 알 필요가 없습니다).
 */
export const collectSubjects = (
    week: Record<string, TodayClass[]>,
): SubjectSummary[] => {
    const map = new Map<string, SubjectSummary>();

    DAYS_ORDER.forEach((day) => {
        (week[day] ?? []).forEach((klass) => {
            // 같은 과목을 두 분반 들을 수는 없지만, 분반까지 키에 넣어야 데이터가
            // 어긋났을 때 조용히 섞이지 않고 두 줄로 드러납니다
            const key = `${klass.subject}\u0000${klass.section}`;
            const found = map.get(key);
            const entry =
                found ??
                {
                    subject: klass.subject,
                    section: klass.section,
                    teacher: klass.teacher,
                    rooms: [],
                    department: klass.department,
                    times: [],
                    periodCount: 0,
                };
            if (!found) map.set(key, entry);

            if (klass.room && !entry.rooms.includes(klass.room))
                entry.rooms.push(klass.room);

            const slot = entry.times.find((t) => t.day === day);
            if (slot) slot.periods.push(klass.period);
            else entry.times.push({ day, periods: [klass.period] });
            entry.periodCount += 1;
        });
    });

    return Array.from(map.values())
        .map((entry) => ({
            ...entry,
            times: entry.times.map((t) => ({
                ...t,
                periods: [...t.periods].sort((a, b) => a - b),
            })),
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
};

/** `[5, 6, 9]` → `"5–6, 9교시"` — 이어진 교시는 붙여 씁니다 */
export const periodLabel = (periods: number[]): string => {
    const runs: number[][] = [];
    periods.forEach((period) => {
        const last = runs[runs.length - 1];
        if (last && period === last[last.length - 1] + 1) last.push(period);
        else runs.push([period]);
    });
    return `${runs
        .map((run) => (run.length > 1 ? `${run[0]}–${run[run.length - 1]}` : `${run[0]}`))
        .join(", ")}교시`;
};
