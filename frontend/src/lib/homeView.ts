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

import type { HomeData, PeriodTime, TodayClass } from "./friendsApi";
import { continuesClass, isBreakGap, isSameClass } from "./schedule";
import { DAYS_ORDER } from "./utils";

export interface HomeView {
    /** 오늘 수업이 있는 날인가 (방학·주말·휴업이 아닌가) */
    isSchoolDay: boolean;
    /** 지금 몇 교시. 쉬는시간이면 null */
    livePeriod: number | null;
    /**
     * 지금이 **쉬는시간**인가 — 방금 끝난 것과 다음 교시 사이가 10분쯤인가.
     *
     * 앞이 꼭 교시일 필요는 없습니다. 학급모임(~13:30)이나 아침식사(~08:30) 뒤도
     * 다음 교시까지 10분이면 교실로 걸어가는 시간입니다. 서버의 `break_name`
     * (점심·저녁·자습)과는 다릅니다 — 그건 이름 붙은 긴 구간입니다.
     *
     * ⚠️ **공강과 구별해야 합니다.** 공강은 수업이 아예 없는 교시, 쉬는시간은 다음
     * 교시가 곧 시작하는 자리입니다. 둘을 같은 말로 부르면 화면이 "수업 끝났다" 고
     * 말해 버립니다. 화면에 쓸 한 마디는 `breakKind` 를 보세요.
     */
    inBreak: boolean;
    /**
     * 쉬는시간에 **무엇을 하는 시간인가** — 다음 교시에 수업이 있으면 교실로 걸어가는
     * `"이동"`, 없으면 그냥 `"공강"` 입니다.
     *
     * 쉬는시간이 아닐 때도 값은 `"공강"` 입니다. 화면은 "지금 뭐 하는 시간인가" 에 늘
     * 한 마디를 붙여야 하는데, 교시 안인데 수업이 없으면 그게 곧 공강이라서입니다.
     *
     * ⚠️ **연강 사이 10분은 여기 해당하지 않습니다.** 같은 교실에서 이어지는 수업이라
     * 옮길 데가 없습니다 — 그 10분은 `periodLabel` 이 `6–7교시 · 쉬는시간` 으로 말합니다.
     */
    breakKind: "이동" | "공강";
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
    /** `"6교시 · 자습"` · `"이동"` 처럼. 수업 없는 날엔 null */
    periodLabel: string | null;
    /** 오늘 비는 시간(분). **연강 사이 10분은 세지 않습니다** — 그건 쉬는시간입니다 */
    freeMinutes: number;
}

export const deriveHomeView = (home: HomeData, liveMinute: number): HomeView => {
    const periods = home.periods ?? [];
    const breaks = home.breaks ?? [];
    const byPeriod = new Map(periods.map((p) => [p.period, p]));
    const isSchoolDay = home.session.has_class;

    const livePeriod = isSchoolDay
        ? (periods.find(
              (p) => liveMinute >= p.start_minute && liveMinute < p.end_minute,
          )?.period ?? null)
        : null;

    /**
     * 앞뒤 교시가 **한 수업인가**. 규칙은 `lib/schedule.ts` 에 있습니다 — 목록·주간
     * 격자·자가 같은 함수를 씁니다.
     *
     * 여기서만 따로 받는 건 `gapFrom`/`gapTo` 입니다. 연강을 앞뒤로 펼칠 때 두 교시가
     * 인접하지 않은 경우도 물어보게 되어서, 교시 번호 조건이 붙은 `continuesClass`
     * 대신 조각 둘을 직접 조합합니다.
     */
    const joined = (a: TodayClass, b: TodayClass, gapFrom: number, gapTo: number) =>
        isSameClass(a, b) && isBreakGap(gapFrom, gapTo);

    let current =
        livePeriod !== null
            ? (home.today.find((c) => c.period === livePeriod) ?? null)
            : null;
    /** 연강을 펼칠 기준 교시. 쉬는시간이면 **직전 교시**가 기준입니다 */
    let anchor = livePeriod;
    let inBreak = false;

    /**
     * ⚠️ **연강 사이의 10분은 수업이 끝난 게 아닙니다.**
     *
     * 교시로만 보면 7교시와 8교시 사이는 아무 교시도 아니라서 `livePeriod` 가 null 이
     * 되고, 그대로 두면 화면이 **"공강"** 이라고 말합니다 — 7·8교시 연강 문학을 듣는
     * 중에 교실을 나가게 되는 말입니다. 앞뒤가 같은 수업이면 **아직 그 수업 중**으로
     * 잡고, 다른 수업이면 공강이 아니라 **쉬는시간**으로 부릅니다.
     */
    if (isSchoolDay && livePeriod === null) {
        const before = [...periods].reverse().find((p) => p.end_minute <= liveMinute);
        const after = periods.find((p) => p.start_minute > liveMinute);

        /**
         * **방금 끝난 것** — 교시일 수도 있고 이름 붙은 구간일 수도 있습니다.
         *
         * ⚠️ 교시만 보면 13:30~13:40 을 놓칩니다. 학급모임(13:20~13:30)이 끝나고
         * 5교시(13:40)까지 10분인데, 앞뒤 **교시**로만 재면 4교시(12:30)와 5교시
         * 사이의 70분이라 공강으로 읽힙니다 — 실제로는 교실로 걸어가는 쉬는시간
         * 입니다. 아침식사 뒤 08:30~08:40 도 같은 자리입니다.
         */
        const ended = [
            ...(before ? [before.end_minute] : []),
            ...breaks.filter((b) => b.end_minute <= liveMinute).map((b) => b.end_minute),
        ];
        if (
            after &&
            ended.length > 0 &&
            isBreakGap(Math.max(...ended), after.start_minute)
        )
            inBreak = true;

        // 연강 판정은 **교시 둘**로만 합니다 — 학급모임을 사이에 두고 이어지는 수업은
        // 없고, 있다 해도 교실을 비웠다 돌아오는 것이라 한 덩어리가 아닙니다
        if (before && after && isBreakGap(before.end_minute, after.start_minute)) {
            const beforeClass = home.today.find((c) => c.period === before.period);
            const afterClass = home.today.find((c) => c.period === after.period);
            if (
                beforeClass &&
                afterClass &&
                joined(beforeClass, afterClass, before.end_minute, after.start_minute)
            ) {
                current = beforeClass;
                anchor = before.period;
            }
        }
    }

    /** 지금 수업을 **연강 단위로 펼칩니다** — 목록·주간 격자가 쓰는 조건과 같습니다 */
    const currentPeriods: number[] = [];
    if (current && anchor !== null) {
        currentPeriods.push(anchor);
        for (let p = anchor - 1; ; p -= 1) {
            const before = home.today.find((c) => c.period === p);
            const beforeTime = byPeriod.get(p);
            const hereTime = byPeriod.get(p + 1);
            if (!before || !beforeTime || !hereTime) break;
            if (!joined(current, before, beforeTime.end_minute, hereTime.start_minute))
                break;
            currentPeriods.unshift(p);
        }
        for (let p = anchor + 1; ; p += 1) {
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

    /**
     * 쉬는시간을 **둘로 가릅니다** — 다음 교시에 수업이 있으면 교실로 걸어가는 시간
     * (`이동`), 없으면 그냥 비는 시간(`공강`)입니다. 같은 10분인데 할 일이 정반대라
     * 한 단어로 부르면 화면이 아무것도 말해 주지 않습니다.
     *
     * ⚠️ **"다음 수업" 이 아니라 "다음 교시" 를 봅니다.** `next` 는 오늘 남은 첫
     * 수업이라 3교시가 비고 5교시에 수업이 있으면 2교시 뒤 쉬는시간에도 걸립니다 —
     * 바로 다음 교시가 비어 있으면 어디로도 가지 않으므로 `공강` 이어야 합니다.
     *
     * 연강 사이 10분은 `current` 가 살아 있어서 제외됩니다 (교실이 같아 옮길 데가
     * 없습니다 — 그건 아래 `breakName` 이 `쉬는시간` 으로 말합니다).
     */
    const upcoming = periods.find((p) => p.start_minute > liveMinute) ?? null;
    const breakKind: "이동" | "공강" =
        inBreak &&
        !current &&
        upcoming &&
        home.today.some((c) => c.period === upcoming.period)
            ? "이동"
            : "공강";

    // 연강이면 `10–11교시` — 히어로가 말하는 시간 범위와 칩이 어긋나면 안 됩니다
    /**
     * ⚠️ 이름 있는 구간(점심·저녁·자습)에는 "쉬는시간" 을 붙이지 않습니다 — 아래에서
     * 그 이름을 그대로 쓰므로, 안 그러면 `쉬는시간 · 점심` 처럼 두 번 말합니다.
     */
    const periodText =
        currentPeriods.length > 1
            ? `${currentPeriods[0]}–${currentPeriods[currentPeriods.length - 1]}교시`
            : livePeriod
              ? `${livePeriod}교시`
              : home.now.break_name
                ? null
                : breakKind;

    /**
     * 연강 사이라면 `7–8교시 · 쉬는시간` 처럼 붙입니다. 수업이 없는 쉬는시간은
     * `periodText` 가 이미 "쉬는시간" 이라 덧붙이지 않습니다 (두 번 쓰게 됩니다).
     */
    const breakName =
        home.now.break_name ?? (inBreak && current ? "쉬는시간" : null);

    const periodLabel = !isSchoolDay
        ? null
        : [periodText, breakName].filter(Boolean).join(" · ");

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
        inBreak,
        breakKind,
        current,
        currentPeriods,
        next,
        periodLabel,
        freeMinutes,
    };
};

// ─── 하루를 덩어리로 ────────────────────────────────────────────────────────

/** 오늘 수업 하나 — **연강이면 여러 교시가 한 덩어리**입니다 */
export interface DayBlock {
    klass: TodayClass;
    /** 이 덩어리가 걸친 교시들. 연강이면 둘 이상 */
    periods: number[];
    /** 첫 교시 */
    start: PeriodTime;
    /** 마지막 교시 — 연강이면 `start` 와 다릅니다 */
    end: PeriodTime;
}

/**
 * 오늘 수업을 **연강 단위로** 묶습니다. 히어로가 앞뒤로 넘기는 단위입니다.
 *
 * ⚠️ 묶는 규칙은 `schedule.ts` 의 `continuesClass` 를 그대로 씁니다 — `currentPeriods`
 * 도 `TodayTimeline` 도 같은 규칙이라, 여기서 조건을 따로 적으면 히어로만 10·11교시를
 * 두 수업으로 세는 일이 생깁니다.
 */
export const dayBlocks = (home: HomeData): DayBlock[] => {
    const byPeriod = new Map((home.periods ?? []).map((p) => [p.period, p]));
    const blocks: DayBlock[] = [];

    [...home.today]
        .sort((a, b) => a.period - b.period)
        .forEach((klass) => {
            const time = byPeriod.get(klass.period);
            if (!time) return;

            const last = blocks[blocks.length - 1];
            if (
                last &&
                continuesClass(
                    {
                        klass: last.klass,
                        period: last.periods[last.periods.length - 1],
                        end_minute: last.end.end_minute,
                    },
                    { klass, period: klass.period, start_minute: time.start_minute },
                )
            ) {
                last.periods.push(klass.period);
                last.end = time;
                return;
            }
            blocks.push({ klass, periods: [klass.period], start: time, end: time });
        });

    return blocks;
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
