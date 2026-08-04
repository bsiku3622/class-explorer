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

export interface HomeView {
    /** 오늘 수업이 있는 날인가 (방학·주말·휴업이 아닌가) */
    isSchoolDay: boolean;
    /** 지금 몇 교시. 쉬는시간이면 null */
    livePeriod: number | null;
    /** 지금 있어야 할 수업. null 이면 공강 */
    current: TodayClass | null;
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

    const next =
        home.today.find(
            (c) => (byPeriod.get(c.period)?.start_minute ?? 0) > liveMinute,
        ) ?? null;

    const periodLabel = !isSchoolDay
        ? null
        : [livePeriod ? `${livePeriod}교시` : "쉬는시간", home.now.break_name]
              .filter(Boolean)
              .join(" · ");

    const freeMinutes = home.today.reduce((sum, item, index) => {
        if (index === 0) return sum;
        const before = home.today[index - 1];
        if (item.period - before.period <= 1) return sum;
        const prev = byPeriod.get(before.period);
        const here = byPeriod.get(item.period);
        return prev && here ? sum + (here.start_minute - prev.end_minute) : sum;
    }, 0);

    return { isSchoolDay, livePeriod, current, next, periodLabel, freeMinutes };
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
